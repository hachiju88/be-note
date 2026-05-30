-- =============================================================
-- 03_client: 顧客系テーブル
-- =============================================================
-- 顧客はプラットフォームレベルで管理する（特定サロンに紐づかない）。
-- ランク・来店回数・メモはサロンごとに t_client_salon で管理する。
-- 年齢は birthday から算出するため保存しない。

-- 顧客 ----------------------------------------------------------
create table t_client (
    client_id     uuid         primary key default gen_random_uuid(),  -- UUID v7（例）
    user_id       uuid         unique references auth.users(id),  -- Supabase Auth 連携。NULL=アプリ未登録の店頭顧客
    family_id     uuid,                       -- 家族グループID（同一IDで家族を紐付け）
    client_name   varchar(20)  not null,
    client_kana   varchar(20)  not null,
    sex           smallint     not null,      -- 1=男性 2=女性
    birthday      date,
    postcode      varchar(10),
    address       varchar(100),
    phone_number  varchar(20),
    hair_type     varchar(30),
    allergy       varchar(30),
    occupation    varchar(20),
    delete_flg    boolean      not null default false,
    constraint check_client_sex check (sex in (1, 2))
);

-- 顧客×サロン（ランク・来店回数・メモをサロンごとに管理）-------
create table t_client_salon (
    client_id    uuid         not null references t_client,
    salon_id     uuid         not null references t_salon,
    client_rank  varchar(10),               -- 'Bronze' | 'Silver' | 'Gold' など
    total_visit  integer      not null default 0,
    first_visit  date,
    memo         varchar(300),
    delete_flg   boolean      not null default false,
    primary key (client_id, salon_id)
);
