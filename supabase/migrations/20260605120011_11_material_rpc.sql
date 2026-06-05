-- =============================================================
-- 11_material_rpc: 入出庫登録の原子的 RPC
-- =============================================================
-- POST /api/v1/materials/{material_id}/transactions の
-- 「台帳追記＋ t_material.current_stock 更新」を 1 トランザクションで行う。
-- 在庫の read-modify-write は FOR UPDATE で対象材料行をロックし、
-- 並行する out/adjust によるロストアップデートを防ぐ。
--
-- quantity の意味（docs/API設計書.md「入出庫登録」）:
--   - in    : 加算する数量（正）          → current_stock += quantity
--   - out   : 減算する数量（正）          → current_stock -= quantity
--   - adjust: 棚卸で数えた実在庫数（絶対値）→ current_stock  = quantity
-- 台帳 quantity は受領値をそのまま記録（adjust は実在庫数＋種別で記録）。
--
-- service_role（API）のみ実行。SECURITY DEFINER で RLS をバイパスして書き込む。
-- エラーはトークン文字列で再送出し、API 層でコードにマップする。
-- =============================================================

create or replace function public.record_material_transaction(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_material uuid    := (payload ->> 'material_id')::uuid;
  v_salon    uuid    := (payload ->> 'salon_id')::uuid;
  v_staff    uuid    := (payload ->> 'staff_id')::uuid;
  v_type     text    := payload ->> 'transaction_type';
  v_qty      numeric := (payload ->> 'quantity')::numeric;
  v_memo     text    := nullif(payload ->> 'memo', '');
  v_current  numeric;
  v_new      numeric;
  v_tx       uuid;
begin
  -- 対象材料を行ロック（自サロン・未削除）。存在しなければ 404 相当。
  select current_stock into v_current
  from t_material
  where material_id = v_material
    and salon_id = v_salon
    and delete_flg = false
  for update;
  if not found then
    raise exception 'MATERIAL_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_new := case v_type
    when 'in'     then v_current + v_qty
    when 'out'    then v_current - v_qty
    when 'adjust' then v_qty
    else null
  end;
  if v_new is null then
    raise exception 'INVALID_TYPE' using errcode = 'P0001';
  end if;
  -- 出庫過多（在庫がマイナスになる）は弾く。check_current_stock とも整合。
  if v_new < 0 then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001';
  end if;

  update t_material
  set current_stock = v_new
  where material_id = v_material
    and salon_id = v_salon;

  insert into t_material_transaction (
    material_id, salon_id, staff_id, transaction_type, quantity, memo
  )
  values (v_material, v_salon, v_staff, v_type, v_qty, v_memo)
  returning transaction_id into v_tx;

  return jsonb_build_object('transaction_id', v_tx);
end;
$$;

-- API（service_role）のみが実行する。一般ロールからは実行不可。
revoke execute on function public.record_material_transaction(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_material_transaction(jsonb) to service_role;
  end if;
end;
$$;
