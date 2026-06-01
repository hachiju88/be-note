-- =============================================================
-- 07_rls: 行レベルセキュリティ（Row Level Security）
-- =============================================================
-- 方針（docs/DB設計書.md「行レベルセキュリティ（RLS）」）:
--   - データアクセスの正面は /api/v1。顧客向け項目マスクはサーバ側で行う。
--   - RLS は deny-by-default の多層防御。全 public テーブルで有効化する。
--   - API（service_role）は RLS をバイパス（Supabase の service_role は BYPASSRLS）。
--   - authenticated には staff/admin 向けポリシーのみ付与し、customer の直接アクセスは閉じる
--     （customer は API 経由に限定 → 項目マスクを必ず通す）。
--   - マイグレーション・seed は所有者（postgres）が実行するため RLS の影響を受けない。
-- =============================================================

-- 1. 認可判定ヘルパー（SECURITY DEFINER で RLS をバイパスし再帰を防ぐ）------
-- auth.uid() は Supabase が提供（JWT の sub = auth.users.id）。
create or replace function public.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from t_staff
    where user_id = auth.uid() and delete_flg = false
  );
$$;

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from t_staff
    where user_id = auth.uid() and delete_flg = false and is_admin = true
  );
$$;

-- ロールからの実行権限（anon/authenticated が RLS 評価時に呼べるように）
grant execute on function public.is_staff()  to anon, authenticated;
grant execute on function public.is_admin()  to anon, authenticated;

-- 2. テーブル権限（GRANT）。実際の行制御は RLS が担う。-----------------
-- service_role は BYPASSRLS のため、RLS 有効でも全行を操作できる。
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;

-- 3. 全 public テーブルで RLS を有効化（deny-by-default）-----------------
do $$
declare
  tbl text;
begin
  for tbl in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', tbl);
  end loop;
end;
$$;

-- 4. ポリシー定義 -------------------------------------------------------
-- 4-1. 固定語彙: t_note_type は全 authenticated が参照可（書き込み不可）
create policy p_note_type_select on public.t_note_type
  for select to authenticated using (true);

-- 4-2. マスタ・設定: SELECT=staff / 書き込み=admin
do $$
declare
  tbl text;
  master_tables text[] := array[
    't_salon_group','t_salon','t_staff','t_menu_master','t_task','t_staff_skill',
    't_business_hour','t_holiday','t_reservation_slot','t_shift'
  ];
begin
  foreach tbl in array master_tables loop
    execute format(
      'create policy p_select on public.%I for select to authenticated using (public.is_staff());', tbl);
    execute format(
      'create policy p_modify on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', tbl);
  end loop;
end;
$$;

-- 4-3. 材料（管理者画面）: 参照・書き込みとも admin
do $$
declare
  tbl text;
  admin_tables text[] := array['t_material','t_material_transaction'];
begin
  foreach tbl in array admin_tables loop
    execute format(
      'create policy p_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', tbl);
  end loop;
end;
$$;

-- 4-4. 業務データ: 参照・書き込みとも staff
do $$
declare
  tbl text;
  staff_tables text[] := array[
    't_client','t_client_salon','t_be_note','t_reservation',
    't_menu','t_sold_item','t_discount','t_photo'
  ];
begin
  foreach tbl in array staff_tables loop
    execute format(
      'create policy p_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff());', tbl);
  end loop;
end;
$$;

-- customer / anon にはマッチするポリシーが無いため、直接アクセスは全拒否される。
-- 顧客向けのデータ提供は /api/v1（service_role）経由でのみ行う。
