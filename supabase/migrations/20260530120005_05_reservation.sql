-- =============================================================
-- 05_reservation: 予約・施術/物販/割引/写真 明細
-- =============================================================

-- 予約明細（t_be_note.note_type = 2 のノードに対応）-----------
create table t_reservation (
    note_id            uuid         primary key references t_be_note,
    salon_id           uuid         not null references t_salon,
    staff_id           uuid         not null references t_staff,  -- この予約の担当スタッフ
    slot_id            uuid         references t_reservation_slot,
    status             varchar(20)  not null default 'confirmed',
      -- 'draft'|'requested'|'pending'|'confirmed'|
      -- 'checked_in'|'in_progress'|'done'|'rejected'|'cancelled'
    reserve_type       varchar(10)  not null default 'immediate',
      -- 'immediate'|'request'
    reservation_start  timestamptz  not null,
    reservation_end    timestamptz  not null,
    actual_start       timestamptz,           -- 実際の来店時刻
    actual_end         timestamptz,           -- 実際の退店時刻
    main_menu          varchar(20)  not null,
    total              integer,               -- 会計合計（税込）NULL=未会計
    payment_method     varchar(10),           -- NULL|'cash'|'card'|'qr'
    current_task_id    uuid         references t_task,
    cancel_reason      varchar(100),
    no_show_flg        boolean      not null default false,
    idempotency_key    uuid         unique,
    version_no         integer      not null default 1,  -- 楽観ロック（編集競合検出。note_version とは別）
    constraint check_reservation_status check (status in ('draft', 'requested', 'pending', 'confirmed', 'checked_in', 'in_progress', 'done', 'rejected', 'cancelled')),
    constraint check_reserve_type check (reserve_type in ('immediate', 'request')),
    constraint check_reservation_time check (reservation_start < reservation_end),
    constraint check_actual_time check (actual_start is null or actual_end is null or actual_start < actual_end),
    constraint check_total_non_negative check (total is null or total >= 0),
    constraint check_payment_method check (payment_method is null or payment_method in ('cash', 'card', 'qr'))
);

-- ダブルブッキング防止（DB層）。draft/cancelled/rejected は対象外＝再予約可。
-- 論理削除時は status を 'cancelled' に更新すること（confirmed のままだと枠をブロックし続ける）。
alter table t_reservation
  add constraint no_double_booking
  exclude using gist (
    staff_id with =,
    (tstzrange(reservation_start, reservation_end, '[)')) with &&
  )
  where (status in ('confirmed', 'checked_in', 'in_progress'));

create index idx_reservation_staff_date
    on t_reservation (staff_id, reservation_start);
create index idx_reservation_status
    on t_reservation (status, reservation_start);

-- 施術明細（note_type = 2 のノードに紐づく）--------------------
create table t_menu (
    menu_id         uuid         primary key default gen_random_uuid(),
    note_id         uuid         not null references t_be_note,
    menu_master_id  uuid         references t_menu_master,  -- 元メニュー（任意。追跡用）
    staff_id        uuid         not null references t_staff,
    menu_name       varchar(20)  not null,   -- 予約時点のメニュー名スナップショット
    kinds           varchar(20),
    memo            varchar(100),
    price           integer      not null,   -- 技術料＋指名料（税込）
    start_time      time,
    end_time        time
);

-- 物販明細（note_type = 3 のノードに紐づく）--------------------
create table t_sold_item (
    item_id    uuid         primary key default gen_random_uuid(),
    note_id    uuid         not null references t_be_note,
    staff_id   uuid         not null references t_staff,
    item_name  varchar(20)  not null,
    kinds      varchar(20),
    memo       varchar(100),
    price      integer      not null   -- 税込
);

-- 割引明細（note_type = 4 のノードに紐づく）--------------------
create table t_discount (
    discount_id    uuid         primary key default gen_random_uuid(),
    note_id        uuid         not null references t_be_note,
    staff_id       uuid         not null references t_staff,
    discount_name  varchar(20)  not null,
    kinds          varchar(20),           -- 'first' | 'campaign' など
    memo           varchar(100),
    price          integer      not null,  -- 負の値（例：-2000）
    constraint check_discount_price check (price <= 0)
);

-- 写真明細（note_type = 5 のノードに紐づく）--------------------
-- ファイルは Supabase Storage に保存し、パスを記録する。
create table t_photo (
    photo_id      uuid         primary key default gen_random_uuid(),
    note_id       uuid         not null references t_be_note,
    staff_id      uuid         not null references t_staff,
    storage_path  varchar(200) not null,   -- Supabase Storage のパス
    memo          varchar(100)
);
