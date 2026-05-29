# API設計書

> Be:note サロン予約管理システム

---

## 共通仕様

### Base URL

```
/api/v1
```

### 認証

```
Authorization: Bearer <JWT>
```

- JWT は Supabase Auth が発行
- ロールクレーム（`role`）：`customer` / `staff` / `admin`
- ロールは DB で管理し、ログイン方式（Google / Instagram / 独自）とは独立する

### 日時フォーマット

- **入出力ともに UTC の ISO 8601**（例：`2026-06-01T01:00:00Z`）
- 表示時はクライアント側で JST（UTC+9）に変換する

### ページネーション

一覧系エンドポイントは以下のクエリに対応する。

```
?page=1&per_page=20
```

レスポンスに以下を含める。

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

### エラーレスポンス

```json
{
  "error": {
    "code": "DOUBLE_BOOKING",
    "message": "指定の時間帯はすでに予約が入っています。"
  }
}
```

| HTTP status | code | 説明 |
|---|---|---|
| 400 | `INVALID_PARAMS` | パラメータ不正 |
| 401 | `UNAUTHORIZED` | 認証失敗・トークン期限切れ |
| 403 | `FORBIDDEN` | 権限不足 |
| 404 | `NOT_FOUND` | リソースなし |
| 409 | `DOUBLE_BOOKING` | ダブルブッキング |
| 409 | `VERSION_CONFLICT` | 楽観ロック競合（他者が先に更新） |
| 409 | `IDEMPOTENCY_CONFLICT` | 同一冪等キーで内容が異なるリクエスト |
| 500 | `INTERNAL_ERROR` | サーバエラー |

---

## エンドポイント一覧

| メソッド | パス | 概要 | 権限 |
|---|---|---|---|
| GET | `/clients/{client_id}` | 顧客情報取得 | staff / admin |
| POST | `/clients` | 顧客新規登録 | staff / admin |
| PUT | `/clients/{client_id}` | 顧客情報更新 | staff / admin |
| GET | `/clients/{client_id}/notes` | Be:note一覧取得 | staff / admin / customer（自分のみ） |
| GET | `/clients/{client_id}/notes/{note_id}` | Be:note詳細取得 | staff / admin / customer（自分のみ） |
| POST | `/clients/{client_id}/notes` | Be:note作成 | staff / admin |
| GET | `/availability` | 空き時間取得 | all |
| GET | `/reservations` | 予約一覧取得 | staff / admin |
| POST | `/reservations` | 即時予約作成 | staff / admin |
| POST | `/reservation-requests` | リクエスト予約申込 | customer |
| GET | `/reservations/{note_id}` | 予約詳細取得 | staff / admin / customer（自分のみ） |
| PUT | `/reservations/{note_id}` | 予約内容編集 | staff / admin |
| PATCH | `/reservations/{note_id}/status` | ステータス更新 | 権限別に制限 |
| PATCH | `/reservations/{note_id}/task` | タスク進行（ボードD&D） | staff / admin |
| GET | `/masters/menus` | メニューマスタ一覧 | staff / admin |
| GET | `/masters/tasks` | タスクマスタ一覧 | staff / admin |
| GET | `/masters/staff` | スタッフ一覧 | staff / admin |
| GET | `/masters/slots` | 予約枠一覧 | staff / admin |
| GET | `/reports/daily` | 日報（期間集計） | admin |
| GET | `/materials` | 材料一覧（在庫） | admin |
| POST | `/materials` | 材料マスタ登録 | admin |
| GET | `/materials/{material_id}/transactions` | 入出庫履歴 | admin |
| POST | `/materials/{material_id}/transactions` | 入出庫登録 | admin |

---

## 顧客（Clients）

### 顧客情報取得

```
GET /api/v1/clients/{client_id}
Auth: staff / admin
```

**レスポンス 200**

```json
{
  "client_id": "0190a1b2-c3d4-7e80-a000-000000000001",
  "family_id": "0190a1b2-c3d4-7e80-a000-0000000000f1",
  "client_name": "顧客太郎",
  "client_kana": "コキャクタロウ",
  "sex": 1,
  "age": 32,
  "birthday": "1993-12-01",
  "postcode": "000-0000",
  "address": "東京都千代田区X-XX",
  "phone_number": "090-xxxx-xxxx",
  "hair_type": "軟毛くせ毛",
  "allergy": "ジアミン",
  "occupation": "会社員",
  "salon_info": {
    "client_rank": "Gold",
    "total_visit": 32,
    "first_visit": "2020-01-15",
    "memo": "会話好き。ツーブロック。重めが好き。"
  },
  "family_list": [
    {
      "client_id": "0190a1b2-c3d4-7e80-a000-000000000005",
      "client_name": "顧客花子",
      "client_kana": "コキャクハナコ",
      "sex": 2,
      "age": 28
    }
  ]
}
```

> `age` は `birthday` から算出してレスポンスに含める（DB には保存しない）  
> `salon_info` は `t_client_salon` から取得（リクエストのサロンに紐づく情報）

---

### 顧客新規登録

```
POST /api/v1/clients
Auth: staff / admin
Body:
{
  "client_name": "顧客太郎",
  "client_kana": "コキャクタロウ",
  "sex": 1,
  "birthday": "1993-12-01",
  "postcode": "000-0000",
  "address": "東京都千代田区X-XX",
  "phone_number": "090-xxxx-xxxx",
  "hair_type": "軟毛くせ毛",
  "allergy": "ジアミン",
  "occupation": "会社員",
  "memo": "会話好き。"
}
Response: 201 { "client_id": "0190a1b2-c3d4-7e80-a000-000000000002" }
```

---

### 顧客情報更新

```
PUT /api/v1/clients/{client_id}
Auth: staff / admin
Body: （3-2 と同形式。変更するフィールドのみ送信可）
Response: 200
```

---

## Be:note

### Be:note一覧取得

```
GET /api/v1/clients/{client_id}/notes
Auth: staff / admin / customer（自分のみ）
Query:
  future_flg : boolean  任意（true=未来の予約のみ）
  page       : integer  任意（default: 1）
  per_page   : integer  任意（default: 20）
```

**レスポンス 200**

```json
{
  "data": [
    {
      "note_id": "0190a1b2-c3d4-7e80-c000-000000000100",
      "p_note_id": "0190a1b2-c3d4-7e80-c000-000000000100",
      "note_type": "head",
      "responsible": {
        "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001",
        "staff_name": "店長太郎"
      },
      "creation_datetime": "2022-12-15T01:10:00Z",
      "future_flg": false,
      "children": [
        {
          "note_id": "0190a1b2-c3d4-7e80-c000-000000000101",
          "note_type": "reservation",
          "reservation_start": "2022-12-31T04:00:00Z",
          "reservation_end": "2022-12-31T06:30:00Z",
          "main_menu": "カット＆カラー",
          "status": "done",
          "total": 18000
        }
      ]
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 45 }
}
```

---

### Be:note詳細取得

```
GET /api/v1/clients/{client_id}/notes/{note_id}
Auth: staff / admin / customer（自分のみ）
```

**レスポンス 200**（note_type が `reservation` の場合）

```json
{
  "note_id": "0190a1b2-c3d4-7e80-c000-000000000101",
  "p_note_id": "0190a1b2-c3d4-7e80-c000-000000000100",
  "note_type": "reservation",
  "responsible": {
    "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001",
    "staff_name": "店長太郎"
  },
  "creation_datetime": "2022-12-15T01:10:00Z",
  "future_flg": false,
  "reservation_start": "2022-12-31T04:00:00Z",
  "reservation_end": "2022-12-31T06:30:00Z",
  "actual_start": "2022-12-31T03:50:00Z",
  "actual_end": "2022-12-31T06:15:00Z",
  "main_menu": "カット＆カラー",
  "status": "done",
  "total": 18000,
  "payment_method": "card",
  "current_task_id": null,
  "menu_list": [
    {
      "menu_id": "0190a1b2-c3d4-7e80-d100-000000000001",
      "menu_name": "cut",
      "kinds": "",
      "staff": { "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001", "staff_name": "店長太郎" },
      "memo": "前髪長め、ひし形シルエット",
      "price": 4500,
      "start_time": "13:05:00",
      "end_time": "13:35:00"
    }
  ]
}
```

> note_type ごとのレスポンス差分：
> - `item`：`menu_list` の代わりに `item_list`
> - `discount`：`discount_list`
> - `photo`：`photo_list`（`storage_path` を Supabase Storage の署名付きURL に変換して返す）
> - `text`：`is_client` / `text` / `read_flg`

---

### Be:note作成

```
POST /api/v1/clients/{client_id}/notes
Auth: staff / admin
Body:
{
  "note_type": "reservation",
  "p_note_id": "0190a1b2-c3d4-7e80-c000-000000000100",
  "future_flg": false,
  // note_type に応じた追加フィールド
}
Response: 201 { "note_id": "0190a1b2-c3d4-7e80-c000-000000000101" }
```

---

## 予約（Reservations）

### 空き時間取得

```
GET /api/v1/availability
Auth: all
Query:
  date           : YYYY-MM-DD  必須
  menu_master_id : uuid     必須（所要時間算出のため）
  staff_id       : string      任意（指名あり検索）
```

**レスポンス 200（customer・指名なし）**

```json
[
  {
    "slots": [
      { "start": "2026-06-01T01:00:00Z", "end": "2026-06-01T02:30:00Z" },
      { "start": "2026-06-01T04:00:00Z", "end": "2026-06-01T05:30:00Z" }
    ]
  }
]
```

**レスポンス 200（customer・指名あり / staff / admin）**

```json
[
  {
    "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001",
    "staff_name": "店長太郎",
    "slots": [
      { "start": "2026-06-01T01:00:00Z", "end": "2026-06-01T02:30:00Z" }
    ]
  }
]
```

---

### 予約一覧取得

```
GET /api/v1/reservations
Auth: staff / admin
Query:
  date_from : YYYY-MM-DD  任意（省略時は当日）
  date_to   : YYYY-MM-DD  任意
  staff_id  : string      任意
  status    : string      任意
  page      : integer     任意
  per_page  : integer     任意
```

**レスポンス 200**

```json
{
  "data": [
    {
      "note_id": "0190a1b2-c3d4-7e80-c000-000000000101",
      "client": { "client_id": "0190a1b2-c3d4-7e80-a000-000000000001", "client_name": "顧客太郎" },
      "staff": { "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001", "staff_name": "店長太郎" },
      "status": "confirmed",
      "reservation_start": "2026-06-01T01:00:00Z",
      "reservation_end": "2026-06-01T02:30:00Z",
      "main_menu": "カット",
      "current_task_id": null
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 8 }
}
```

---

### 即時予約作成

```
POST /api/v1/reservations
Auth: staff / admin
Header: Idempotency-Key: <UUID>
Body:
{
  "client_id"         : "0190a1b2-c3d4-7e80-a000-000000000001",
  "staff_id"          : "0190a1b2-c3d4-7e80-b000-000000000001",
  "slot_id"           : "0190a1b2-c3d4-7e80-e000-000000000001",
  "reservation_start" : "2026-06-01T01:00:00Z",
  "reservation_end"   : "2026-06-01T02:30:00Z",
  "main_menu"         : "カット＆カラー",
  "menu_list": [
    {
      "menu_name" : "cut",
      "kinds"     : "",
      "staff_id"  : "0190a1b2-c3d4-7e80-b000-000000000001",
      "memo"      : "前髪長め",
      "price"     : 4500
    }
  ]
}
Response: 201 { "note_id": "..." }
Error   : 409 DOUBLE_BOOKING
```

---

### リクエスト予約申込（顧客操作）

```
POST /api/v1/reservation-requests
Auth: customer
Header: Idempotency-Key: <UUID>
Body:
{
  "desired_start"  : "2026-06-01T01:00:00Z",
  "menu_master_id" : "0190a1b2-c3d4-7e80-d000-000000000002",
  "staff_id"       : "0190a1b2-c3d4-7e80-b000-000000000001"  // 任意（指名なし可）
}
Response: 201 { "note_id": "...", "status": "requested" }
```

---

### 予約内容編集

```
PUT /api/v1/reservations/{note_id}
Auth: staff / admin
Body:
{
  "staff_id"          : "0190a1b2-c3d4-7e80-b000-000000000001",
  "reservation_start" : "2026-06-01T02:00:00Z",
  "reservation_end"   : "2026-06-01T03:30:00Z",
  "main_menu"         : "カット",
  "menu_list"         : [...],
  "version_no"        : 1   // 楽観ロック。不一致なら 409 VERSION_CONFLICT
}
Response: 200
Error   : 409 DOUBLE_BOOKING / 409 VERSION_CONFLICT
```

---

### ステータス更新

```
PATCH /api/v1/reservations/{note_id}/status
Auth: staff / admin（customer は cancelled のみ可）
Body:
{
  "status" : "confirmed",
  "reason" : "..."  // cancelled / rejected 時のみ
}
Response: 200
Error   : 409 DOUBLE_BOOKING（confirmed への遷移時）
```

**キャンセル期限チェック（customer のみ）**

- `t_salon.cancel_deadline_days` の日数以内の場合は 403 を返す
- スタッフ・管理者は期限に関係なくキャンセル可能

---

### タスク進行（予約ボード D&D）

```
PATCH /api/v1/reservations/{note_id}/task
Auth: staff / admin
Body: { "task_id": "0190a1b2-c3d4-7e80-f000-000000000003" }
Response: 200
```

---

## マスタ（Masters）

### メニューマスタ一覧

```
GET /api/v1/masters/menus
Auth: staff / admin
Response: 200
[
  {
    "menu_master_id": "0190a1b2-c3d4-7e80-d000-000000000002",
    "menu_name": "cut",
    "kinds": "",
    "base_price": 4500,
    "duration_minutes": 30
  }
]
```

---

### タスクマスタ一覧

```
GET /api/v1/masters/tasks
Auth: staff / admin
Response: 200
[
  { "task_id": "0190a1b2-c3d4-7e80-f000-000000000001", "task_name": "check_in", "task_order": 1, "role_limit": null },
  { "task_id": "0190a1b2-c3d4-7e80-f000-000000000002", "task_name": "wash",     "task_order": 2, "role_limit": null }
]
```

---

### スタッフ一覧

```
GET /api/v1/masters/staff
Auth: staff / admin
Response: 200
[
  {
    "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001",
    "staff_name": "店長太郎",
    "staff_kana": "テンチョウタロウ",
    "role": "stylist",
    "nomination_fee": 500
  }
]
```

---

### 予約枠一覧

```
GET /api/v1/masters/slots
Auth: staff / admin
Response: 200
[
  { "slot_id": "0190a1b2-c3d4-7e80-e000-000000000001", "slot_name": "カットコース" }
]
```

---

## 日報（Reports）

### 日報（期間集計）

```
GET /api/v1/reports/daily
Auth: admin
Query:
  date_from : YYYY-MM-DD  任意（省略時は当日）
  date_to   : YYYY-MM-DD  任意（省略時は date_from と同日）
```

会計済み（`status = 'done'`）の予約を対象に集計する。

**レスポンス 200**

```json
{
  "period": { "date_from": "2026-05-29", "date_to": "2026-05-29" },
  "summary": {
    "sales_total": 184000,
    "customer_count": 12,
    "average_spend": 15333,
    "cancel_count": 1,
    "no_show_count": 0
  },
  "payment_breakdown": [
    { "method": "cash", "amount": 60000 },
    { "method": "card", "amount": 100000 },
    { "method": "qr",   "amount": 24000 }
  ],
  "by_staff": [
    {
      "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001",
      "staff_name": "店長太郎",
      "sales": 92000,
      "treatment_count": 6
    }
  ],
  "by_menu": [
    { "menu_name": "cut", "count": 8, "sales": 36000 }
  ]
}
```

> 集計元：`t_reservation`（`total` / `payment_method` / `staff_id` / `status`）、`t_menu`（スタッフ別・メニュー別）、`t_sold_item` / `t_discount`。CSV エクスポートは将来対応。

---

## 材料（Materials）

### 材料一覧（在庫）

```
GET /api/v1/materials
Auth: admin
Query:
  low_stock_only : boolean  任意（true=発注点割れのみ）
```

**レスポンス 200**

```json
[
  {
    "material_id": "0190a1b2-c3d4-7e80-a100-000000000001",
    "material_name": "カラー剤A",
    "unit": "g",
    "current_stock": 320.0,
    "reorder_point": 500.0,
    "low_stock": true
  }
]
```

> `low_stock` は `current_stock <= reorder_point` をサーバが算出して返す。

---

### 材料マスタ登録

```
POST /api/v1/materials
Auth: admin
Body:
{
  "material_name" : "カラー剤A",
  "unit"          : "g",
  "reorder_point" : 500.0
}
Response: 201 { "material_id": "..." }
```

---

### 入出庫履歴

```
GET /api/v1/materials/{material_id}/transactions
Auth: admin
Query:
  date_from : YYYY-MM-DD  任意
  date_to   : YYYY-MM-DD  任意
```

**レスポンス 200**

```json
[
  {
    "transaction_id": "0190a1b2-c3d4-7e80-a200-000000000001",
    "transaction_type": "in",
    "quantity": 1000.0,
    "transaction_datetime": "2026-05-20T01:00:00Z",
    "staff": { "staff_id": "0190a1b2-c3d4-7e80-b000-000000000001", "staff_name": "店長太郎" },
    "memo": "定期発注分"
  }
]
```

---

### 入出庫登録

```
POST /api/v1/materials/{material_id}/transactions
Auth: admin
Body:
{
  "transaction_type" : "out",     // 'in' | 'out' | 'adjust'
  "quantity"         : 50.0,
  "memo"             : "施術消費"
}
Response: 201 { "transaction_id": "..." }
```

- 登録時に `t_material.current_stock` を更新する（`in` は加算、`out` は減算、`adjust` は棚卸後の実数との差分を反映）。
