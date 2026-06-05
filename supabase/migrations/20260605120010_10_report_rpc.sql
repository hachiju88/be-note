-- =============================================================
-- 10_report_rpc: 日報（期間集計）の集計 RPC
-- =============================================================
-- GET /api/v1/reports/daily の集計を SQL（GROUP BY）で行う。
-- アプリ層で全行をロードしないことで、PostgREST の行数上限
-- （config.toml max_rows=1000）による暗黙の打ち切り＝過少集計を回避する。
--
-- 対象: status='done' かつ親 t_be_note が論理削除されていない予約。
-- 集計元（docs/API設計書.md「日報」）:
--   - 売上/客数/支払内訳 … t_reservation（total / payment_method）
--   - スタッフ別/メニュー別 … t_menu（price / staff_id / menu_master_id / menu_name）
-- キャンセル数とノーショー数は排他カウント（cancel_count はノーショーを含まない）。
-- payment_method が NULL の done は内訳 'unknown' に集約し、Σ内訳=sales_total を保つ。
-- by_menu は menu_master_id があれば master 単位で集約（改名による分裂を防ぐ）、
-- 無ければ menu_name（スナップショット）単位。
--
-- service_role（API）のみ実行。SECURITY DEFINER で RLS をバイパスして集計する。
-- =============================================================

create or replace function public.report_daily(
  p_salon_id  uuid,
  p_start_utc timestamptz,
  p_end_utc   timestamptz
)
  returns jsonb
  language sql
  security definer
  set search_path = public
  stable
as $$
  with done as (
    -- 会計済み・自サロン・親ノート有効・reservation_start が範囲内（半開区間）。
    select r.note_id, r.total, r.payment_method
    from t_reservation r
    join t_be_note b on b.note_id = r.note_id
    where b.delete_flg = false
      and r.salon_id = p_salon_id
      and r.status = 'done'
      and r.reservation_start >= p_start_utc
      and r.reservation_start <  p_end_utc
  ),
  menu as (
    select m.staff_id, m.menu_master_id, m.menu_name, m.price
    from t_menu m
    where m.note_id in (select note_id from done)
  ),
  pay as (
    -- payment_method NULL は 'unknown' に集約（Σ内訳 = sales_total を維持）。
    select coalesce(payment_method, 'unknown') as method,
           sum(coalesce(total, 0))             as amount
    from done
    group by coalesce(payment_method, 'unknown')
  ),
  staff_agg as (
    select mn.staff_id,
           s.staff_name,
           sum(coalesce(mn.price, 0)) as sales,
           count(*)                   as treatment_count
    from menu mn
    left join t_staff s on s.staff_id = mn.staff_id
    group by mn.staff_id, s.staff_name
  ),
  menu_agg as (
    -- master があれば master 単位、無ければ snapshot 名単位で集約。
    select coalesce(mn.menu_master_id::text, 'name:' || mn.menu_name) as menu_key,
           -- グループ内で master id は一定（master キー時）か NULL（name キー時）。
           -- max(uuid) は無いため text 経由で代表値を取る。
           max(mn.menu_master_id::text)::uuid as menu_master_id,
           max(mn.menu_name)                  as menu_name,
           count(*)               as cnt,
           sum(coalesce(mn.price, 0)) as sales
    from menu mn
    group by coalesce(mn.menu_master_id::text, 'name:' || mn.menu_name)
  ),
  cancel as (
    -- 純粋なキャンセル（ノーショーを除く）。
    select count(*) as cnt
    from t_reservation r
    join t_be_note b on b.note_id = r.note_id
    where b.delete_flg = false
      and r.salon_id = p_salon_id
      and r.status = 'cancelled'
      and r.no_show_flg = false
      and r.reservation_start >= p_start_utc
      and r.reservation_start <  p_end_utc
  ),
  noshow as (
    select count(*) as cnt
    from t_reservation r
    join t_be_note b on b.note_id = r.note_id
    where b.delete_flg = false
      and r.salon_id = p_salon_id
      and r.no_show_flg = true
      and r.reservation_start >= p_start_utc
      and r.reservation_start <  p_end_utc
  )
  select jsonb_build_object(
    'sales_total',    coalesce((select sum(coalesce(total, 0)) from done), 0),
    'customer_count', (select count(*) from done),
    'cancel_count',   (select cnt from cancel),
    'no_show_count',  (select cnt from noshow),
    'payment_breakdown', coalesce((
      select jsonb_agg(
               jsonb_build_object('method', method, 'amount', amount)
               -- cash, card, qr, unknown の順に固定。
               order by case method
                 when 'cash' then 1 when 'card' then 2 when 'qr' then 3 else 4 end
             )
      from pay
    ), '[]'::jsonb),
    'by_staff', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'staff_id',        staff_id,
                 'staff_name',      staff_name,
                 'sales',           sales,
                 'treatment_count', treatment_count
               ) order by sales desc
             )
      from staff_agg
    ), '[]'::jsonb),
    'by_menu', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'menu_master_id', menu_master_id,
                 'menu_name',      menu_name,
                 'count',          cnt,
                 'sales',          sales
               ) order by sales desc
             )
      from menu_agg
    ), '[]'::jsonb)
  );
$$;

-- API（service_role）のみが実行する。一般ロールからは実行不可。
revoke execute on function public.report_daily(uuid, timestamptz, timestamptz) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.report_daily(uuid, timestamptz, timestamptz) to service_role;
  end if;
end;
$$;
