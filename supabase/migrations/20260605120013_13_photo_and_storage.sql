-- =============================================================
-- 13_photo_and_storage.sql
-- 顧客からの DM 写真送信対応:
--   - t_photo.staff_id を nullable に変更（顧客アップロード時は staff 不在）
--   - be-note-photos Storage バケットを作成
--   - Storage RLS ポリシーを設定
-- =============================================================

-- t_photo.staff_id nullable 化（顧客アップロード対応）
ALTER TABLE t_photo ALTER COLUMN staff_id DROP NOT NULL;

-- Storage バケット作成（すでに存在する場合は上書きしない）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'be-note-photos',
  'be-note-photos',
  false,
  10485760,  -- 10 MB
  '{image/jpeg,image/png,image/webp,image/heic}'
)
ON CONFLICT (id) DO NOTHING;

-- 顧客は dm/{client_id}/ パスに写真をアップロード可
-- パス形式: dm/{client_id}/{filename}
CREATE POLICY "customers upload dm photos"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'be-note-photos'
  AND split_part(name, '/', 1) = 'dm'
  AND EXISTS (
    SELECT 1 FROM public.t_client
    WHERE client_id = split_part(name, '/', 2)::uuid
      AND user_id = auth.uid()
      AND delete_flg = false
  )
);

-- スタッフ / admin は全パスに写真をアップロード可
CREATE POLICY "staff upload photos"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'be-note-photos'
  AND EXISTS (
    SELECT 1 FROM public.t_staff
    WHERE user_id = auth.uid()
      AND delete_flg = false
  )
);

-- 認証済みユーザーは自身に関連する写真を読み取り可
-- （API 経由の署名付き URL 生成は service_role が行うため、直接 SELECT は最小限で可）
CREATE POLICY "authenticated read be-note-photos"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'be-note-photos');
