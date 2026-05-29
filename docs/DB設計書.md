# DB設計書

> Be:note サロン予約管理システム

---

## 概要

- DB：PostgreSQL（Supabase）
- 文字コード：UTF-8
- タイムゾーン：UTC で保存、表示時に JST 変換
- 論理削除：`delete_flg BOOLEAN NOT NULL DEFAULT false` で統一
- 日時型：`TIMESTAMPTZ`（タイムゾーン付き）
- 主キー：全テーブル **UUID（v7 推奨）**。時系列ソート可・クライアント生成可で、スマホアプリのオフライン作成／同期に対応する。サーバ採番は `gen_random_uuid()`、クライアント採番は UUID v7 を用いる
- 識別子の人間可読性は PK に持たせない。表示用は名称カラムや `creation_datetime` を用いる
- 例外：`t_note_type` は固定語彙のため `SMALLINT`（コード値 `note_type_code` で受け渡し）

---

## ER図

```mermaid
erDiagram
    t_salon_group ||--o{ t_salon : "group_id"
    t_salon ||--o{ t_staff : "salon_id"
    t_salon ||--o{ t_menu_master : "salon_id"
    t_salon ||--o{ t_task : "salon_id"
    t_salon ||--o{ t_reservation_slot : "salon_id"
    t_salon ||--o{ t_business_hour : "salon_id"
    t_salon ||--o{ t_holiday : "salon_id"
    t_salon ||--o{ t_client_salon : "salon_id"
    t_client ||--o{ t_client_salon : "client_id"
    t_client ||--o{ t_be_note : "client_id"
    t_note_type ||--o{ t_be_note : "note_type"
    t_staff ||--o{ t_staff_skill : "staff_id"
    t_task ||--o{ t_staff_skill : "task_id"
    t_staff ||--o{ t_shift : "staff_id"
    t_be_note ||--o| t_reservation : "note_id"
    t_be_note ||--o{ t_menu : "note_id"
    t_be_note ||--o{ t_sold_item : "note_id"
    t_be_note ||--o{ t_discount : "note_id"
    t_be_note ||--o{ t_photo : "note_id"
    t_be_note ||--o{ t_be_note : "p_note_id"
    t_reservation ||--o| t_staff : "staff_id"
    t_reservation ||--o| t_reservation_slot : "slot_id"
    t_salon ||--o{ t_material : "salon_id"
    t_material ||--o{ t_material_transaction : "material_id"
    t_staff ||--o{ t_material_transaction : "staff_id"
```

---

## テーブル定義

### マスタ系

#### t_salon_group（サロングループ）

```sql
CREATE TABLE t_salon_group (
    group_id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),       -- UUID v7（例）
    group_name  VARCHAR(50)  NOT NULL,
    delete_flg  BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_salon（サロン）

```sql
CREATE TABLE t_salon (
    salon_id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),    -- UUID v7（例）
    group_id              UUID  REFERENCES t_salon_group,
    salon_name            VARCHAR(50)  NOT NULL,
    salon_type            VARCHAR(20)  NOT NULL DEFAULT 'hair',
      -- 'hair' | 'nail' | 'esthe' | 'other'
    address               VARCHAR(100),
    phone                 VARCHAR(20),
    cancel_deadline_days  INTEGER      NOT NULL DEFAULT 1,
      -- キャンセル可能期限（日数）。1=当日キャンセル不可
    delete_flg            BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_staff（スタッフ）

```sql
CREATE TABLE t_staff (
    staff_id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),    -- UUID v7（例）
    salon_id        UUID  NOT NULL REFERENCES t_salon,
    staff_name      VARCHAR(20)  NOT NULL,
    staff_kana      VARCHAR(20),
    role            VARCHAR(10)  NOT NULL,
      -- 'admin' | 'stylist' | 'assistant'
    nomination_fee  INTEGER      NOT NULL DEFAULT 0,  -- 指名料（税込）
    delete_flg      BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_staff_skill（スタッフ可能タスク）

アシスタントのタスク制限を管理する。レコードが存在するタスクのみ担当可能。

```sql
CREATE TABLE t_staff_skill (
    staff_id  UUID  NOT NULL REFERENCES t_staff,
    task_id   UUID      NOT NULL REFERENCES t_task,
    PRIMARY KEY (staff_id, task_id)
);
```

#### t_menu_master（メニューマスタ）

```sql
CREATE TABLE t_menu_master (
    menu_master_id   UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id         UUID  NOT NULL REFERENCES t_salon,
    menu_name        VARCHAR(20)  NOT NULL,   -- 'cut' | 'color' | 'treatment' ...
    kinds            VARCHAR(20),             -- 種別（'short_color' など）
    base_price       INTEGER      NOT NULL,   -- 技術料（税込）
    duration_minutes INTEGER      NOT NULL,   -- 標準所要時間（分）
    delete_flg       BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_task（工程マスタ）

予約ボードの列（check_in → wash → cut → ... → check_out）を定義する。

```sql
CREATE TABLE t_task (
    task_id     UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id    UUID  NOT NULL REFERENCES t_salon,
    task_name   VARCHAR(20)  NOT NULL,    -- 'check_in' | 'wash' | 'cut' ...
    task_order  INTEGER      NOT NULL,    -- 列の表示順
    role_limit  VARCHAR(10)  DEFAULT NULL -- NULL=制限なし | 'stylist'=スタイリスト以上
);
```

#### t_note_type（note種別マスタ）

```sql
CREATE TABLE t_note_type (
    note_type_id   SMALLINT     PRIMARY KEY,
    note_type_code VARCHAR(20)  NOT NULL UNIQUE,  -- API で使用する文字列
    description    VARCHAR(50)
);

INSERT INTO t_note_type VALUES
  (1, 'head',        '来店親ノード'),
  (2, 'reservation', '予約'),
  (3, 'item',        '物販'),
  (4, 'discount',    '割引'),
  (5, 'photo',       '写真'),
  (6, 'text',        'テキストメッセージ');
```

#### t_business_hour（営業時間マスタ）

```sql
CREATE TABLE t_business_hour (
    salon_id    UUID  NOT NULL REFERENCES t_salon,
    day_of_week SMALLINT     NOT NULL,  -- 0=日 1=月 ... 6=土
    open_time   TIME         NOT NULL,
    close_time  TIME         NOT NULL,
    PRIMARY KEY (salon_id, day_of_week)
);
```

#### t_holiday（定休日・臨時休業）

```sql
CREATE TABLE t_holiday (
    salon_id      UUID  NOT NULL REFERENCES t_salon,
    holiday_date  DATE         NOT NULL,
    reason        VARCHAR(50),   -- '定休日' | '夏季休業' など
    PRIMARY KEY (salon_id, holiday_date)
);
```

#### t_shift（スタッフシフト）

```sql
CREATE TABLE t_shift (
    shift_id    UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id    UUID  NOT NULL REFERENCES t_staff,
    shift_date  DATE         NOT NULL,
    start_time  TIME         NOT NULL,
    end_time    TIME         NOT NULL,
    delete_flg  BOOLEAN      NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_shift_staff_date
    ON t_shift (staff_id, shift_date)
    WHERE delete_flg = false;
```

#### t_reservation_slot（予約枠）

```sql
CREATE TABLE t_reservation_slot (
    slot_id     UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id    UUID  NOT NULL REFERENCES t_salon,
    slot_name   VARCHAR(30)  NOT NULL,
    delete_flg  BOOLEAN      NOT NULL DEFAULT false
);
```

---

### 顧客系

#### t_client（顧客）

顧客はプラットフォームレベルで管理する（特定サロンに紐づかない）。  
ランク・来店回数・メモはサロンごとに `t_client_salon` で管理する。  
年齢（`age`）は `birthday` から算出するため保存しない。

```sql
CREATE TABLE t_client (
    client_id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),   -- UUID v7（例）
    family_id    UUID       ,                -- 家族グループID（同一IDで家族を紐付け）
    client_name  VARCHAR(20)  NOT NULL,
    client_kana  VARCHAR(20)  NOT NULL,
    sex          SMALLINT     NOT NULL,      -- 1=男性 2=女性
    birthday     DATE,
    postcode     VARCHAR(10),
    address      VARCHAR(100),
    phone_number VARCHAR(20),
    hair_type    VARCHAR(30),
    allergy      VARCHAR(30),
    occupation   VARCHAR(20),
    delete_flg   BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_client_salon（顧客×サロン）

顧客とサロンの関係。ランク・来店回数・メモをサロンごとに管理する。

```sql
CREATE TABLE t_client_salon (
    client_id    UUID  NOT NULL REFERENCES t_client,
    salon_id     UUID  NOT NULL REFERENCES t_salon,
    client_rank  VARCHAR(10),               -- 'Bronze' | 'Silver' | 'Gold' など
    total_visit  INTEGER      NOT NULL DEFAULT 0,
    first_visit  DATE,
    memo         VARCHAR(300),
    delete_flg   BOOLEAN      NOT NULL DEFAULT false,
    PRIMARY KEY (client_id, salon_id)
);
```

---

### Be:note系

#### t_be_note（Be:note共通ヘッダ）

1来店 = 1つの `head` ノードを親とする。  
`p_note_id` が自分自身の場合は `head`（親ノード）。

```sql
CREATE TABLE t_be_note (
    note_id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
      -- UUID v7（クライアント生成可。来店親ノードは p_note_id = 自分自身）
    p_note_id        UUID  NOT NULL REFERENCES t_be_note(note_id),
    version_number     INTEGER      NOT NULL DEFAULT 1,
    note_type          SMALLINT     NOT NULL REFERENCES t_note_type(note_type_id),
    salon_id           UUID  NOT NULL REFERENCES t_salon,
    client_id          UUID  NOT NULL REFERENCES t_client,
    responsible        UUID  NOT NULL REFERENCES t_staff(staff_id),
    creation_datetime  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    future_flg         BOOLEAN      NOT NULL DEFAULT false,  -- true=未来の予約
    is_client          BOOLEAN,     -- textノードのみ使用（true=顧客からのメッセージ）
    text               VARCHAR(300),  -- textノードのみ使用
    read_flg           BOOLEAN,     -- textノードのみ使用
    delete_flg         BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX idx_be_note_client ON t_be_note (client_id, salon_id);
CREATE INDEX idx_be_note_parent ON t_be_note (p_note_id);
```

#### t_reservation（予約明細）

`t_be_note.note_type = 2`（reservation）のノードに対応する明細。

```sql
CREATE TABLE t_reservation (
    note_id          UUID  PRIMARY KEY REFERENCES t_be_note,
    salon_id           UUID  NOT NULL REFERENCES t_salon,
    staff_id           UUID  NOT NULL REFERENCES t_staff,
    slot_id            UUID      REFERENCES t_reservation_slot,
    status             VARCHAR(20)  NOT NULL DEFAULT 'confirmed',
      -- 'draft'|'requested'|'pending'|'confirmed'|
      -- 'checked_in'|'in_progress'|'done'|'rejected'|'cancelled'
    reserve_type       VARCHAR(10)  NOT NULL DEFAULT 'immediate',
      -- 'immediate'|'request'
    reservation_start  TIMESTAMPTZ  NOT NULL,
    reservation_end    TIMESTAMPTZ  NOT NULL,
    actual_start       TIMESTAMPTZ,           -- 実際の来店時刻
    actual_end         TIMESTAMPTZ,           -- 実際の退店時刻
    main_menu          VARCHAR(20)  NOT NULL,
    total              INTEGER,               -- 会計合計（税込）NULL=未会計
    payment_method     VARCHAR(10),           -- NULL|'cash'|'card'|'qr'
    current_task_id    UUID      REFERENCES t_task,
    cancel_reason      VARCHAR(100),
    no_show_flg        BOOLEAN      NOT NULL DEFAULT false,
    idempotency_key    UUID         UNIQUE,
    version_no         INTEGER      NOT NULL DEFAULT 1   -- 楽観ロック
);

-- ダブルブッキング防止（DB層）
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE t_reservation
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(reservation_start, reservation_end, '[)') WITH &&
  )
  WHERE (status IN ('confirmed', 'checked_in', 'in_progress'));

CREATE INDEX idx_reservation_staff_date
    ON t_reservation (staff_id, reservation_start);
CREATE INDEX idx_reservation_status
    ON t_reservation (status, reservation_start);
```

#### t_menu（施術明細）

`t_be_note.note_type = 2`（reservation）のノードに紐づく施術ごとの明細。

```sql
CREATE TABLE t_menu (
    menu_id    UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id  UUID  NOT NULL REFERENCES t_be_note,
    staff_id   UUID  NOT NULL REFERENCES t_staff,
    menu_name  VARCHAR(20)  NOT NULL,
    kinds      VARCHAR(20),
    memo       VARCHAR(100),
    price      INTEGER      NOT NULL,   -- 技術料＋指名料（税込）
    start_time TIME,
    end_time   TIME
);
```

#### t_sold_item（物販明細）

`t_be_note.note_type = 3`（item）のノードに紐づく販売商品ごとの明細。

```sql
CREATE TABLE t_sold_item (
    item_id    UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id  UUID  NOT NULL REFERENCES t_be_note,
    staff_id   UUID  NOT NULL REFERENCES t_staff,
    item_name  VARCHAR(20)  NOT NULL,
    kinds      VARCHAR(20),
    memo       VARCHAR(100),
    price      INTEGER      NOT NULL   -- 税込
);
```

#### t_discount（割引明細）

`t_be_note.note_type = 4`（discount）のノードに紐づく割引ごとの明細。

```sql
CREATE TABLE t_discount (
    discount_id    UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id      UUID  NOT NULL REFERENCES t_be_note,
    staff_id       UUID  NOT NULL REFERENCES t_staff,
    discount_name  VARCHAR(20)  NOT NULL,
    kinds          VARCHAR(20),           -- 'first' | 'campaign' など
    memo           VARCHAR(100),
    price          INTEGER      NOT NULL  -- 負の値（例：-2000）
);
```

#### t_photo（写真明細）

`t_be_note.note_type = 5`（photo）のノードに紐づく写真ごとの明細。  
ファイルは Supabase Storage に保存し、パスを記録する。

```sql
CREATE TABLE t_photo (
    photo_id   UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id  UUID  NOT NULL REFERENCES t_be_note,
    staff_id   UUID  NOT NULL REFERENCES t_staff,
    storage_path VARCHAR(200) NOT NULL,   -- Supabase Storage のパス
    memo       VARCHAR(100)
);
```

---

### 材料系

材料管理画面（管理者）で使用する。**材料マスタ＋入出庫台帳**の構成。在庫数は台帳から算出するのが正だが、参照性能のため `t_material.current_stock` にキャッシュし、入出庫登録時に更新する。

#### t_material（材料マスタ）

```sql
CREATE TABLE t_material (
    material_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id       UUID         NOT NULL REFERENCES t_salon,
    material_name  VARCHAR(50)  NOT NULL,
    unit           VARCHAR(10)  NOT NULL,            -- '本' | 'g' | 'ml' | '個' など
    current_stock  NUMERIC(10,2) NOT NULL DEFAULT 0, -- 現在庫（台帳から更新するキャッシュ）
    reorder_point  NUMERIC(10,2) NOT NULL DEFAULT 0, -- 発注点。current_stock <= で低在庫アラート
    delete_flg     BOOLEAN      NOT NULL DEFAULT false
);
```

#### t_material_transaction（入出庫台帳）

```sql
CREATE TABLE t_material_transaction (
    transaction_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id          UUID          NOT NULL REFERENCES t_material,
    salon_id             UUID          NOT NULL REFERENCES t_salon,
    staff_id             UUID          NOT NULL REFERENCES t_staff,  -- 操作者
    transaction_type     VARCHAR(10)   NOT NULL,   -- 'in'（入庫）| 'out'（出庫）| 'adjust'（棚卸調整）
    quantity             NUMERIC(10,2) NOT NULL,    -- 正の数量（type で増減を解釈。adjust は差分）
    transaction_datetime TIMESTAMPTZ   NOT NULL DEFAULT now(),
    memo                 VARCHAR(100),
    delete_flg           BOOLEAN       NOT NULL DEFAULT false
);

CREATE INDEX idx_material_tx_material
    ON t_material_transaction (material_id, transaction_datetime);
```

> 施術（メニュー）ごとの材料消費量（BOM）連携は将来拡張。MVP は手動の入出庫登録とする。

---

## インデックス一覧

| テーブル | インデックス | カラム | 用途 |
|---|---|---|---|
| `t_be_note` | `idx_be_note_client` | `(client_id, salon_id)` | Be:note一覧取得 |
| `t_be_note` | `idx_be_note_parent` | `(p_note_id)` | 子ノード取得 |
| `t_reservation` | `idx_reservation_staff_date` | `(staff_id, reservation_start)` | 予約管理画面・ダブルブッキングチェック |
| `t_reservation` | `idx_reservation_status` | `(status, reservation_start)` | 予約受付画面・日報集計 |
| `t_shift` | `idx_shift_staff_date` | `(staff_id, shift_date)` WHERE `delete_flg=false` | 空き時間算出 |
| `t_material_transaction` | `idx_material_tx_material` | `(material_id, transaction_datetime)` | 入出庫履歴・在庫算出 |
