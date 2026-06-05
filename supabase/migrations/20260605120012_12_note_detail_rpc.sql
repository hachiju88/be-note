-- =============================================================
-- 12_note_detail_rpc: 明細付き Be:note 作成の原子的 RPC
-- =============================================================
-- POST /api/v1/clients/{client_id}/notes の item / discount / photo を
-- 「t_be_note（ノード）＋明細（t_sold_item / t_discount / t_photo）」の
-- 複数テーブル書き込みとして 1 トランザクションで作成する。
-- 明細だけ失敗してノードが孤児化するのを防ぐ（reservation RPC と同方針）。
--
-- payload:
--   note_type_id : 3(item) | 4(discount) | 5(photo)
--   p_note_id    : 親 head の note_id（アプリ層で head・同一顧客を検証済み）
--   salon_id, client_id, responsible, future_flg
--   details      : 明細配列。各要素は staff_id（アプリ層で解決・サロン検証済み）と
--                  種別ごとのフィールドを持つ。
--
-- service_role（API）のみ実行。SECURITY DEFINER で RLS をバイパスして書き込む。
-- =============================================================

create or replace function public.create_note_with_details(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_type    smallint := (payload ->> 'note_type_id')::smallint;
  v_parent  uuid     := (payload ->> 'p_note_id')::uuid;
  v_salon   uuid     := (payload ->> 'salon_id')::uuid;
  v_client  uuid     := (payload ->> 'client_id')::uuid;
  v_resp    uuid     := (payload ->> 'responsible')::uuid;
  v_future  boolean  := coalesce((payload ->> 'future_flg')::boolean, false);
  v_details jsonb    := payload -> 'details';
  v_note    uuid;
  d         jsonb;
begin
  -- 明細ノード（head の子）。
  insert into t_be_note (p_note_id, note_type, salon_id, client_id, responsible, future_flg)
  values (v_parent, v_type, v_salon, v_client, v_resp, v_future)
  returning note_id into v_note;

  for d in select * from jsonb_array_elements(v_details)
  loop
    if v_type = 3 then
      insert into t_sold_item (note_id, staff_id, item_name, kinds, memo, price)
      values (
        v_note,
        (d ->> 'staff_id')::uuid,
        d ->> 'item_name',
        d ->> 'kinds',
        d ->> 'memo',
        (d ->> 'price')::integer
      );
    elsif v_type = 4 then
      insert into t_discount (note_id, staff_id, discount_name, kinds, memo, price)
      values (
        v_note,
        (d ->> 'staff_id')::uuid,
        d ->> 'discount_name',
        d ->> 'kinds',
        d ->> 'memo',
        (d ->> 'price')::integer
      );
    elsif v_type = 5 then
      insert into t_photo (note_id, staff_id, storage_path, memo)
      values (
        v_note,
        (d ->> 'staff_id')::uuid,
        d ->> 'storage_path',
        d ->> 'memo'
      );
    else
      raise exception 'INVALID_NOTE_TYPE' using errcode = 'P0001';
    end if;
  end loop;

  return jsonb_build_object('note_id', v_note);
end;
$$;

-- API（service_role）のみが実行する。一般ロールからは実行不可。
revoke execute on function public.create_note_with_details(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_note_with_details(jsonb) to service_role;
  end if;
end;
$$;
