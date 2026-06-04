-- =============================================================
-- 08_reservation_rpc: 即時予約作成の原子的 RPC
-- =============================================================
-- POST /api/v1/reservations の複数テーブル書き込み（head＋予約ノード＋
-- t_reservation＋t_menu 明細）を 1 トランザクションで行う。
-- 二重防御（docs/予約ロジック設計書.md）:
--   - アプリ層: Idempotency-Key（t_reservation.idempotency_key UNIQUE）で冪等。
--   - DB 層: t_reservation.no_double_booking（EXCLUDE）で重複枠を排他。
-- EXCLUDE 違反は 'DOUBLE_BOOKING' として再送出し、API は 409 DOUBLE_BOOKING にマップ。
-- 同一 idempotency_key は既存の予約 note_id を返す（冪等リプレイ）。
--
-- service_role（API）から呼ぶ前提。SECURITY DEFINER で RLS をバイパスして書き込む。
-- =============================================================

create or replace function public.create_immediate_reservation(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_salon     uuid        := (payload ->> 'salon_id')::uuid;
  v_staff     uuid        := (payload ->> 'staff_id')::uuid;
  v_client    uuid        := (payload ->> 'client_id')::uuid;
  v_slot      uuid        := nullif(payload ->> 'slot_id', '')::uuid;
  v_start     timestamptz := (payload ->> 'reservation_start')::timestamptz;
  v_end       timestamptz := (payload ->> 'reservation_end')::timestamptz;
  v_main_menu text        := payload ->> 'main_menu';
  v_future    boolean     := coalesce((payload ->> 'future_flg')::boolean, false);
  v_idem      uuid        := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_head      uuid;
  v_note      uuid;
  v_existing  uuid;
  v_menu      jsonb;
begin
  -- 冪等: 同一キーの予約が既にあれば既存を返す。
  if v_idem is not null then
    select note_id into v_existing
    from t_reservation
    where idempotency_key = v_idem;
    if found then
      return jsonb_build_object('note_id', v_existing, 'idempotent', true);
    end if;
  end if;

  -- head（来店）ノード。
  insert into t_be_note (p_note_id, note_type, salon_id, client_id, responsible, future_flg)
  values (null, 1, v_salon, v_client, v_staff, v_future)
  returning note_id into v_head;

  -- 予約ノード（head の子）。
  insert into t_be_note (p_note_id, note_type, salon_id, client_id, responsible, future_flg)
  values (v_head, 2, v_salon, v_client, v_staff, v_future)
  returning note_id into v_note;

  -- 予約明細。status=confirmed が EXCLUDE 対象に入りダブルブッキングを排他。
  insert into t_reservation (
    note_id, salon_id, staff_id, slot_id, status, reserve_type,
    reservation_start, reservation_end, main_menu, idempotency_key, version_no
  ) values (
    v_note, v_salon, v_staff, v_slot, 'confirmed', 'immediate',
    v_start, v_end, v_main_menu, v_idem, 1
  );

  -- 施術明細（menu_list）。
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

  return jsonb_build_object('note_id', v_note, 'head_note_id', v_head, 'idempotent', false);

exception
  when exclusion_violation then
    -- DB 層の EXCLUDE（no_double_booking）。例外で全 insert はロールバックされる。
    raise exception 'DOUBLE_BOOKING' using errcode = 'P0001';
  when unique_violation then
    -- idempotency_key の並行競合 → 既存を返す（冪等）。
    if v_idem is not null then
      select note_id into v_existing
      from t_reservation
      where idempotency_key = v_idem;
      if found then
        return jsonb_build_object('note_id', v_existing, 'idempotent', true);
      end if;
    end if;
    raise;
end;
$$;

-- API（service_role）のみが実行する。一般ロールからは実行不可。
revoke execute on function public.create_immediate_reservation(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_immediate_reservation(jsonb) to service_role;
  end if;
end;
$$;
