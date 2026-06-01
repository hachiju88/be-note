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
--
-- ⚠️ 新テーブルを追加するマイグレーションでは、本ファイルと同様に
--    「RLS 有効化 ＋ GRANT ＋ ポリシー定義」を必ず行うこと。
--    下記の有効化ループ・GRANT は本マイグレーション時点のテーブルのみを対象とするスナップショットで、
--    将来のテーブルは自動では保護されない（RLS 無効・GRANT 無しのまま取り残される）。
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

-- 実行権限は authenticated のみに付与（anon は述語を満たさず呼ぶ必要がないため最小権限）。
-- ※ 関数は既定で PUBLIC に EXECUTE が付くため、明示的に剥がしてから付与する。
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_staff()  to authenticated;
grant execute on function public.is_admin()  to authenticated;

-- 2. テーブル権限（GRANT）。実際の行制御は RLS が担う。-----------------
-- service_role は BYPASSRLS のため、RLS 有効でも全行を操作できる。
-- ※ スナップショット（現テーブルのみ）。新テーブルは各マイグレーションで再付与すること。
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;

-- 3. 全 public テーブルで RLS を有効化（deny-by-default）-----------------
-- ※ 本ループは適用時点のテーブルのみを対象とする（将来テーブルは未対象。ファイル冒頭の注意参照）。
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
-- ⚠️ MVP は 1 店舗固定のため、ポリシーは本人性（is_staff/is_admin）のみで判定し salon_id では絞らない。
--    多店舗化フェーズでは、越境アクセス（他店データの読み書き）を防ぐため
--    各ポリシーに salon_id スコープ（例: salon_id = current_staff_salon_id()）を追加すること。

-- 4-1. 固定語彙: t_note_type は全 authenticated が参照可（書き込み不可）
create policy p_note_type_select on public.t_note_type
  for select to authenticated using (true);

-- 4-2. 一括ポリシー生成 ------------------------------------------------
do $$
declare
  tbl text;
  spec record;
  -- マスタ・設定: SELECT=staff / 書き込み=admin（2 ポリシー）
  master_tables text[] := array[
    't_salon_group','t_salon','t_staff','t_menu_master','t_task','t_staff_skill',
    't_business_hour','t_holiday','t_reservation_slot','t_shift'
  ];
begin
  -- マスタ・設定
  foreach tbl in array master_tables loop
    execute format(
      'create policy p_select on public.%I for select to authenticated using (public.is_staff());', tbl);
    execute format(
      'create policy p_modify on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', tbl);
  end loop;

  -- 全操作ポリシー（材料=admin / 業務データ=staff）を (判定関数, テーブル群) で一括生成
  for spec in
    select 'public.is_admin()' as fn,
           array['t_material','t_material_transaction'] as tables
    union all
    select 'public.is_staff()' as fn,
           array['t_client','t_client_salon','t_be_note','t_reservation',
                 't_menu','t_sold_item','t_discount','t_photo'] as tables
  loop
    foreach tbl in array spec.tables loop
      execute format(
        'create policy p_all on public.%I for all to authenticated using (%s) with check (%s);',
        tbl, spec.fn, spec.fn);
    end loop;
  end loop;
end;
$$;

-- customer / anon にはマッチするポリシーが無いため、直接アクセスは全拒否される。
-- 顧客向けのデータ提供は /api/v1（service_role）経由でのみ行う。
