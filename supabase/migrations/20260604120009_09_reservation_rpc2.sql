-- =============================================================
-- 09_reservation_rpc2: 予約編集・リクエスト予約の RPC
-- =============================================================
-- PUT /reservations/{id} と POST /reservation-requests の原子的処理。
-- いずれも複数テーブル／楽観ロック／二重防御を伴うためトランザクション RPC 化する。
-- エラーは P0001＋メッセージ（VERSION_CONFLICT / DOUBLE_BOOKING / NOT_FOUND /
-- INVALID_REFERENCE）で送出し、API が共通エラーへマップする。
-- service_role（API）から呼ぶ前提。SECURITY DEFINER。
-- =============================================================

-- ---- 予約編集（PUT）----------------------------------------------------------
-- version_no 楽観ロックで競合検出。明細は全置換。confirmed 系は EXCLUDE で二重防御。
create or replace function public.update_reservation(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_note      uuid        := (payload ->> 'note_id')::uuid;
  v_staff     uuid        := (payload ->> 'staff_id')::uuid;
  v_start     timestamptz := (payload ->> 'reservation_start')::timestamptz;
  v_end       timestamptz := (payload ->> 'reservation_end')::timestamptz;
  v_main_menu text        := payload ->> 'main_menu';
  v_version   integer     := (payload ->> 'version_no')::integer;
  v_menu      jsonb;
  v_updated   integer;
begin
  -- 対象の存在確認（論理削除されていない予約ノードか）。
  if not exists (
    select 1
    from t_reservation r
    join t_be_note b on b.note_id = r.note_id
    where r.note_id = v_note and b.delete_flg = false
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 楽観ロック付き更新。version 不一致なら 0 行更新 → VERSION_CONFLICT。
  update t_reservation
  set staff_id          = v_staff,
      reservation_start = v_start,
      reservation_end   = v_end,
      main_menu         = v_main_menu,
      version_no        = version_no + 1
  where note_id = v_note and version_no = v_version;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  -- 予約ノードと親 head の responsible（主担当）を staff_id に同期する。
  update t_be_note
  set responsible = v_staff
  where note_id = v_note
     or note_id = (select p_note_id from t_be_note where note_id = v_note);

  -- 明細は全置換。
  delete from t_menu where note_id = v_note;
  for v_menu in
    select * from jsonb_array_elements(coalesce(payload -> 'menu_list', '[]'::jsonb))
  loop
    insert into t_menu (note_id, menu_master_id, staff_id, menu_name, kinds, memo, price)
    values (
      v_note,
      nullif(v_menu ->> 'menu_master_id', '')::uuid,
      coalesce(nullif(v_menu ->> 'staff_id', '')::uuid, v_staff),
      v_menu ->> 'menu_name',
      v_menu ->> 'kinds',
      v_menu ->> 'memo',
      (v_menu ->> 'price')::integer
    );
  end loop;

  return jsonb_build_object('note_id', v_note, 'version_no', v_version + 1);

exception
  when exclusion_violation then
    raise exception 'DOUBLE_BOOKING' using errcode = 'P0001';
  when foreign_key_violation then
    raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
end;
$$;

-- ---- リクエスト予約申込（顧客）----------------------------------------------
-- status=requested で作成（枠はブロックしない＝EXCLUDE 対象外）。所要時間は
-- menu_master.duration_minutes から reservation_end を算出。
create or replace function public.create_reservation_request(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_client    uuid        := (payload ->> 'client_id')::uuid;
  v_staff     uuid        := (payload ->> 'staff_id')::uuid;
  v_menu_mst  uuid        := (payload ->> 'menu_master_id')::uuid;
  v_start     timestamptz := (payload ->> 'desired_start')::timestamptz;
  v_idem      uuid        := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_salon     uuid;
  v_menu_name text;
  v_duration  integer;
  v_end       timestamptz;
  v_head      uuid;
  v_note      uuid;
  v_existing  uuid;
begin
  if v_idem is not null then
    -- 論理削除済みは有効な予約として返さない（delete_flg=false に限定）。
    select r.note_id into v_existing
    from t_reservation r
    join t_be_note b on b.note_id = r.note_id
    where r.idempotency_key = v_idem and b.delete_flg = false;
    if found then
      return jsonb_build_object('note_id', v_existing, 'status', 'requested', 'idempotent', true);
    end if;
  end if;

  -- メニューから salon / 名称 / 所要時間を取得。
  select salon_id, menu_name, duration_minutes
  into v_salon, v_menu_name, v_duration
  from t_menu_master
  where menu_master_id = v_menu_mst and delete_flg = false;
  if not found then
    raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
  end if;
  v_end := v_start + make_interval(mins => v_duration);

  -- head＋予約ノード（リクエストは未来予約）。responsible は指名スタッフ。
  insert into t_be_note (p_note_id, note_type, salon_id, client_id, responsible, future_flg)
  values (null, 1, v_salon, v_client, v_staff, true)
  returning note_id into v_head;
  insert into t_be_note (p_note_id, note_type, salon_id, client_id, responsible, future_flg)
  values (v_head, 2, v_salon, v_client, v_staff, true)
  returning note_id into v_note;

  insert into t_reservation (
    note_id, salon_id, staff_id, status, reserve_type,
    reservation_start, reservation_end, main_menu, idempotency_key, version_no
  ) values (
    v_note, v_salon, v_staff, 'requested', 'request',
    v_start, v_end, v_menu_name, v_idem, 1
  );

  return jsonb_build_object('note_id', v_note, 'status', 'requested', 'idempotent', false);

exception
  when foreign_key_violation then
    raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
  when unique_violation then
    if v_idem is not null then
      select r.note_id into v_existing
      from t_reservation r
      join t_be_note b on b.note_id = r.note_id
      where r.idempotency_key = v_idem and b.delete_flg = false;
      if found then
        return jsonb_build_object('note_id', v_existing, 'status', 'requested', 'idempotent', true);
      end if;
    end if;
    raise;
end;
$$;

-- 実行は service_role（API）のみ。
revoke execute on function public.update_reservation(jsonb) from public, anon, authenticated;
revoke execute on function public.create_reservation_request(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.update_reservation(jsonb) to service_role;
    grant execute on function public.create_reservation_request(jsonb) to service_role;
  end if;
end;
$$;
