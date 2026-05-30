-- =============================================================
-- 02_master: マスタ系テーブル
-- =============================================================
-- 方針（docs/DB設計書.md）:
--   PK は全テーブル UUID（v7 推奨・クライアント生成可）。サーバ採番は gen_random_uuid()。
--   日時は TIMESTAMPTZ（UTC 保存）。論理削除は delete_flg で統一。
--   連関/設定テーブル（t_staff_skill / t_business_hour / t_holiday）は delete_flg を持たず物理削除。

-- サロングループ ------------------------------------------------
create table t_salon_group (
    group_id    uuid         primary key default gen_random_uuid(),  -- UUID v7（例）
    group_name  varchar(50)  not null,
    delete_flg  boolean      not null default false
);

-- サロン --------------------------------------------------------
create table t_salon (
    salon_id              uuid         primary key default gen_random_uuid(),  -- UUID v7（例）
    group_id              uuid         references t_salon_group,
    salon_name            varchar(50)  not null,
    salon_type            varchar(20)  not null default 'hair',
      -- 'hair' | 'nail' | 'esthe' | 'other'
    address               varchar(100),
    phone                 varchar(20),
    cancel_deadline_days  integer      not null default 1,
      -- キャンセル可能期限（日数）。1=当日キャンセル不可
    delete_flg            boolean      not null default false
);

-- スタッフ ------------------------------------------------------
create table t_staff (
    staff_id        uuid         primary key default gen_random_uuid(),  -- UUID v7（例）
    user_id         uuid         unique references auth.users(id),  -- Supabase Auth 連携（ログインユーザー）
    salon_id        uuid         not null references t_salon,
    staff_name      varchar(20)  not null,
    staff_kana      varchar(20),
    position        varchar(10)  not null,            -- 職位: 'stylist' | 'assistant'
    is_admin        boolean      not null default false,  -- 管理者権限（true で JWT ロール=admin を付与）
    nomination_fee  integer      not null default 0,  -- 指名料（税込）
    delete_flg      boolean      not null default false
);

-- note種別マスタ（固定語彙のため SMALLINT）----------------------
create table t_note_type (
    note_type_id    smallint     primary key,
    note_type_code  varchar(20)  not null unique,  -- API で使用する文字列
    description     varchar(50)
);

insert into t_note_type values
  (1, 'head',        '来店親ノード'),
  (2, 'reservation', '予約'),
  (3, 'item',        '物販'),
  (4, 'discount',    '割引'),
  (5, 'photo',       '写真'),
  (6, 'text',        'テキストメッセージ');

-- メニューマスタ ------------------------------------------------
create table t_menu_master (
    menu_master_id    uuid         primary key default gen_random_uuid(),
    salon_id          uuid         not null references t_salon,
    menu_name         varchar(20)  not null,   -- 'cut' | 'color' | 'treatment' ...
    kinds             varchar(20),             -- 種別（'short_color' など）
    base_price        integer      not null,   -- 技術料（税込）
    duration_minutes  integer      not null,   -- 標準所要時間（分）
    delete_flg        boolean      not null default false
);

-- 工程マスタ（予約ボードの列）----------------------------------
create table t_task (
    task_id     uuid         primary key default gen_random_uuid(),
    salon_id    uuid         not null references t_salon,
    task_name   varchar(20)  not null,    -- 'check_in' | 'wash' | 'cut' ...
    task_order  integer      not null,    -- 列の表示順
    role_limit  varchar(10)  default null -- NULL=制限なし | 'stylist'=position が stylist のみ可
);

-- スタッフ可能タスク（連関テーブル・物理削除）------------------
create table t_staff_skill (
    staff_id  uuid  not null references t_staff,
    task_id   uuid  not null references t_task,
    primary key (staff_id, task_id)
);

-- 営業時間マスタ（設定テーブル・物理削除）----------------------
create table t_business_hour (
    salon_id     uuid      not null references t_salon,
    day_of_week  smallint  not null,  -- 0=日 1=月 ... 6=土
    open_time    time      not null,
    close_time   time      not null,
    primary key (salon_id, day_of_week)
);

-- 定休日・臨時休業（設定テーブル・物理削除）--------------------
create table t_holiday (
    salon_id      uuid         not null references t_salon,
    holiday_date  date         not null,
    reason        varchar(50),   -- '定休日' | '夏季休業' など
    primary key (salon_id, holiday_date)
);

-- スタッフシフト ------------------------------------------------
create table t_shift (
    shift_id    uuid     primary key default gen_random_uuid(),
    staff_id    uuid     not null references t_staff,
    shift_date  date     not null,
    start_time  time     not null,
    end_time    time     not null,
    delete_flg  boolean  not null default false
);

-- 1日に複数シフト（中抜け・分割シフト）を許容するため一意制約は設けない。
-- 同一スタッフの時間帯重複は排他制約で防ぐ。
create index idx_shift_staff_date
    on t_shift (staff_id, shift_date)
    where delete_flg = false;

alter table t_shift
  add constraint no_shift_overlap
  exclude using gist (
    staff_id with =,
    (tsrange(shift_date + start_time, shift_date + end_time)) with &&
  )
  where (delete_flg = false);

-- 予約枠 --------------------------------------------------------
create table t_reservation_slot (
    slot_id     uuid         primary key default gen_random_uuid(),
    salon_id    uuid         not null references t_salon,
    slot_name   varchar(30)  not null,
    delete_flg  boolean      not null default false
);
