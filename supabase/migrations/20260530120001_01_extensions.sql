-- =============================================================
-- 01_extensions: 拡張機能
-- =============================================================
-- gen_random_uuid()（全テーブルのPK既定値）に必要
create extension if not exists pgcrypto with schema extensions;

-- EXCLUDE USING gist による時間帯重複の排他制約に必要
-- （t_reservation のダブルブッキング防止 / t_shift のシフト重複防止）
create extension if not exists btree_gist with schema extensions;
