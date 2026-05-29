# API設計書

> Be:note サロン予約管理システム  
> 版数：00.01 / 2026-05-29

---

## 1. 共通仕様

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

## 2. エンドポイント一覧

| # | メソッド | パス | 概要 | 権限 |
|---|---|---|---|---|
| 1 | GET | `/clients/{client_id}` | 顧客情報取得 | staff / admin |
| 2 | POST | `/clients` | 顧客新規登録 | staff / admin |
| 3 | PUT | `/clients/{client_id}` | 顧客情報更新 | staff / admin |
| 4 | GET | `/clients/{client_id}/notes` | Be:note一覧取得 | staff / admin / customer（自分のみ） |
| 5 | GET | `/clients/{client_id}/notes/{note_code}` | Be:note詳細取得 | staff / admin / customer（自分のみ） |
| 6 | POST | `/clients/{client_id}/notes` | Be:note作成 | staff / admin |
| 7 | GET | `/availability` | 空き時間取得 | all |
| 8 | GET | `/reservations` | 予約一覧取得 | staff / admin |
| 9 | POST | `/reservations` | 即時予約作成 | staff / admin |
| 10 | POST | `/reservation-requests` | リクエスト予約申込 | customer |
| 11 | GET | `/reservations/{reservation_id}` | 予約詳細取得 | staff / admin / customer（自分のみ） |
| 12 | PUT | `/reservations/{reservation_id}` | 予約内容編集 | staff / admin |
| 13 | PATCH | `/reservations/{reservation_id}/status` | ステータス更新 | 権限別に制限 |
| 14 | PATCH | `/reservations/{reservation_id}/task` | タスク進行（ボードD&D） | staff / admin |
| 15 | GET | `/masters/menus` | メニューマスタ一覧 | staff / admin |
| 16 | GET | `/masters/tasks` | タスクマスタ一覧 | staff / admin |
| 17 | GET | `/masters/staff` | スタッフ一覧 | staff / admin |
| 18 | GET | `/masters/slots` | 予約枠一覧 | staff / admin |

---

## 3. 顧客（Clients）

### 3-1. 顧客情報取得

```
GET /api/v1/clients/{client_id}
Auth: staff / admin
```

**レスポンス 200**

```json
{
  "client_id": "CID0000001",
  "family_id": "FID0000015",
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
      "client_id": "CID0000005",
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

### 3-2. 顧客新規登録

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
Response: 201 { "client_id": "CID0000002" }
```

---

### 3-3. 顧客情報更新

```
PUT /api/v1/clients/{client_id}
Auth: staff / admin
Body: （3-2 と同形式。変更するフィールドのみ送信可）
Response: 200
```

---

## 4. Be:note

### 4-1. Be:note一覧取得

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
      "note_code": "CID0000001_20221215_101000_000",
      "p_note_code": "CID0000001_20221215_101000_000",
      "note_type": "head",
      "responsible": {
        "staff_id": "STF0000001",
        "staff_name": "店長太郎"
      },
      "creation_datetime": "2022-12-15T01:10:00Z",
      "future_flg": false,
      "children": [
        {
          "note_code": "CID0000001_20221215_101000_001",
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

### 4-2. Be:note詳細取得

```
GET /api/v1/clients/{client_id}/notes/{note_code}
Auth: staff / admin / customer（自分のみ）
```

**レスポンス 200**（note_type が `reservation` の場合）

```json
{
  "note_code": "CID0000001_20221215_101000_001",
  "p_note_code": "CID0000001_20221215_101000_000",
  "note_type": "reservation",
  "responsible": {
    "staff_id": "STF0000001",
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
      "menu_id": 1,
      "menu_name": "cut",
      "kinds": "",
      "staff": { "staff_id": "STF0000001", "staff_name": "店長太郎" },
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

### 4-3. Be:note作成

```
POST /api/v1/clients/{client_id}/notes
Auth: staff / admin
Body:
{
  "note_type": "reservation",
  "p_note_code": "CID0000001_20221215_101000_000",
  "future_flg": false,
  // note_type に応じた追加フィールド
}
Response: 201 { "note_code": "CID0000001_20221215_101000_001" }
```

---

## 5. 予約（Reservations）

### 5-1. 空き時間取得

```
GET /api/v1/availability
Auth: all
Query:
  date           : YYYY-MM-DD  必須
  menu_master_id : integer     必須（所要時間算出のため）
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
    "staff_id": "STF0000001",
    "staff_name": "店長太郎",
    "slots": [
      { "start": "2026-06-01T01:00:00Z", "end": "2026-06-01T02:30:00Z" }
    ]
  }
]
```

---

### 5-2. 予約一覧取得

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
      "note_code": "CID0000001_20221215_101000_001",
      "client": { "client_id": "CID0000001", "client_name": "顧客太郎" },
      "staff": { "staff_id": "STF0000001", "staff_name": "店長太郎" },
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

### 5-3. 即時予約作成

```
POST /api/v1/reservations
Auth: staff / admin
Header: Idempotency-Key: <UUID>
Body:
{
  "client_id"         : "CID0000001",
  "staff_id"          : "STF0000001",
  "slot_id"           : 1,
  "reservation_start" : "2026-06-01T01:00:00Z",
  "reservation_end"   : "2026-06-01T02:30:00Z",
  "main_menu"         : "カット＆カラー",
  "menu_list": [
    {
      "menu_name" : "cut",
      "kinds"     : "",
      "staff_id"  : "STF0000001",
      "memo"      : "前髪長め",
      "price"     : 4500
    }
  ]
}
Response: 201 { "note_code": "..." }
Error   : 409 DOUBLE_BOOKING
```

---

### 5-4. リクエスト予約申込（顧客操作）

```
POST /api/v1/reservation-requests
Auth: customer
Header: Idempotency-Key: <UUID>
Body:
{
  "desired_start"  : "2026-06-01T01:00:00Z",
  "menu_master_id" : 2,
  "staff_id"       : "STF0000001"  // 任意（指名なし可）
}
Response: 201 { "note_code": "...", "status": "requested" }
```

---

### 5-5. 予約内容編集

```
PUT /api/v1/reservations/{note_code}
Auth: staff / admin
Body:
{
  "staff_id"          : "STF0000001",
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

### 5-6. ステータス更新

```
PATCH /api/v1/reservations/{note_code}/status
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

### 5-7. タスク進行（予約ボード D&D）

```
PATCH /api/v1/reservations/{note_code}/task
Auth: staff / admin
Body: { "task_id": 3 }
Response: 200
```

---

## 6. マスタ（Masters）

### 6-1. メニューマスタ一覧

```
GET /api/v1/masters/menus
Auth: staff / admin
Response: 200
[
  {
    "menu_master_id": 1,
    "menu_name": "cut",
    "kinds": "",
    "base_price": 4500,
    "duration_minutes": 30
  }
]
```

---

### 6-2. タスクマスタ一覧

```
GET /api/v1/masters/tasks
Auth: staff / admin
Response: 200
[
  { "task_id": 1, "task_name": "check_in", "task_order": 1, "role_limit": null },
  { "task_id": 2, "task_name": "wash",     "task_order": 2, "role_limit": null }
]
```

---

### 6-3. スタッフ一覧

```
GET /api/v1/masters/staff
Auth: staff / admin
Response: 200
[
  {
    "staff_id": "STF0000001",
    "staff_name": "店長太郎",
    "staff_kana": "テンチョウタロウ",
    "role": "stylist",
    "nomination_fee": 500
  }
]
```

---

### 6-4. 予約枠一覧

```
GET /api/v1/masters/slots
Auth: staff / admin
Response: 200
[
  { "slot_id": 1, "slot_name": "カットコース" }
]
```
