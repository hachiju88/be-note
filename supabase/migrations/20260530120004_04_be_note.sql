-- =============================================================
-- 04_be_note: Be:note 共通ヘッダ（木構造）
-- =============================================================
-- 1来店 = 1つの head ノードを親とする木構造。
-- p_note_id が NULL の場合は head（親ノード／ルート）。

create table t_be_note (
    note_id            uuid         primary key default gen_random_uuid(),  -- UUID v7（クライアント生成可）
    p_note_id          uuid         references t_be_note(note_id),  -- NULL=head（親ノード／ルート）
    note_version       integer      not null default 1,  -- 編集版番号（楽観ロック兼用。過去版は保持しない）
    note_type          smallint     not null references t_note_type(note_type_id),
    salon_id           uuid         not null references t_salon,
    client_id          uuid         not null references t_client,
    responsible        uuid         not null references t_staff(staff_id),  -- 来店全体の主担当
    creation_datetime  timestamptz  not null default now(),
    future_flg         boolean      not null default false,  -- true=未来の予約
    is_client          boolean,     -- textノードのみ使用（true=顧客からのメッセージ）
    text               varchar(300),  -- textノードのみ使用
    read_flg           boolean,     -- textノードのみ使用
    delete_flg         boolean      not null default false
);

create index idx_be_note_client on t_be_note (client_id, salon_id);
create index idx_be_note_parent on t_be_note (p_note_id);
