# CLAUDE.md — Be:note サロン予約管理システム

Claude Code がこのリポジトリで作業するときの前提。**現在は設計フェーズが完了し、
実装直前**の段階。仕様の正典は `docs/` 配下の Markdown 設計書 4 本。

---

## 1. プロジェクト概要

**Be:note** は美容系サービス（美容室・ネイル・エステ等）向けの予約管理システム。

- **Be:note** = 顧客カルテ兼「店舗⇄顧客の交換ノート」。**1 顧客 = 1 つの Be:note**。
- 管理対象: ①顧客情報 ②note（1 来店 = 1 件の施術/会計記録）③History_note（過去note）
  ＋ DM（テキスト・画像）と未来予約参照。
- 利用者ロール: **customer**（モバイルアプリ・自分のみ）/ **staff** / **admin**。
  Web 管理ツールは staff 以上、管理者メニューは admin のみ。

---

## 2. リポジトリ構成（モノレポ・予定）

| ディレクトリ | 用途 | 状態 |
|---|---|---|
| `docs/` | 設計書一式（Markdown）= **仕様の正典** | ✅ あり |
| `web/` | Next.js + TypeScript（サロン用 Web 管理ツール・顧客向け Web） | 未作成 |
| `mobile/` | React Native（Expo）顧客向けアプリ | 未作成 |
| `supabase/migrations/` | DB マイグレーション（DDL） | 未作成 |
| `.claude/` | Claude Code 設定・プロジェクトスキル | ✅ あり |
| `.gemini/` | Gemini Code Assist（PR 自動レビュー）設定 | ✅ あり |

`web/` のルーティングは Next.js Route Groups で認証状態・ロール別にレイアウト分離
（`(auth)` / `(app)` / `(admin)`、画面設計書参照）。

---

## 3. 設計書（docs/）— まずここを読む

| ファイル | 内容 |
|---|---|
| `docs/画面設計書.md` | 9 画面の仕様・画面遷移・共通ヘッダ・権限差分 |
| `docs/API設計書.md` | `/api/v1` エンドポイント・リクエスト/レスポンス・エラーコード |
| `docs/DB設計書.md` | 全テーブル DDL・ER 図・インデックス |
| `docs/予約ロジック設計書.md` | 状態遷移・ダブルブッキング防止・空き時間算出・技術スタック |

> **文書間整合性が最重要**。テーブル名・カラム名・エンドポイント・status・note_type は
> 4 文書で一致している必要がある。片方だけ直して他方とズレる変更をしない
> （`.gemini/styleguide.md` のレビュー観点と同じ）。

---

## 4. 技術スタック

| レイヤー | 採用技術 |
|---|---|
| フロント（Web） | **Next.js + TypeScript** |
| モバイル | **React Native（Expo）** |
| 認証 | **Supabase Auth**（Google / Instagram / Be:note独自。LINE はフェーズ2） |
| DB | **Supabase（PostgreSQL）** |
| リアルタイム | Supabase Realtime（予約ボード同期） |
| ファイル | Supabase Storage（ビフォー/アフター写真。署名付き URL で配信） |
| API | `/api/v1`（Bearer JWT） |

---

## 5. 設計の要点・規約（実装時に必ず守る）

### データモデル（DB設計書）
- テーブル名は `t_` プレフィックス。
- **主キーは全テーブル UUID（v7 推奨）**。クライアント生成可（オフライン作成/同期対応）。
  サーバ採番は `gen_random_uuid()`。例外: `t_note_type` のみ固定語彙の `SMALLINT`。
- 論理削除は `delete_flg BOOLEAN NOT NULL DEFAULT false` で統一。
  ただし `delete_flg` を持たない連関/設定テーブル（`t_staff_skill` / `t_business_hour` /
  `t_holiday`）は**物理削除**。
- 日時は `TIMESTAMPTZ`で **UTC 保存・表示時 JST 変換**。
- `salon_id` は最初から全テーブルに保持（MVP は 1 店舗固定、多店舗は将来）。

### 認証・権限（API設計書）
- JWT は Supabase Auth 発行。ロール `customer` / `staff` / `admin`。
- **権限は `t_staff.is_admin`** から導出（true→admin）。**職位 `t_staff.position`
  （stylist / assistant）は施術上の区分で、権限とは独立**。混同しない。
- JWT の `sub`（= `auth.users.id`）を `t_client.user_id` / `t_staff.user_id` と突合して
  本人特定。customer の「自分のみ」ポリシーはこれで強制。
- **ロール別フィールドマスクはサーバ側で行う**。customer には施術時間（`start_time` /
  `end_time`）等の管理項目をレスポンスから除外する（クライアント非表示に依存しない）。

### API 共通
- Base `/api/v1`、`Authorization: Bearer <JWT>`。日時は **ISO 8601 UTC**（例 `2026-06-01T01:00:00Z`）。
- 一覧は `?page=&per_page=`、レスポンスに `pagination`。
- エラーは `{ "error": { "code", "message" } }`（コード一覧は API設計書）。

### 予約ロジック（予約ロジック設計書）
- status 遷移は state machine に従う（即時: `draft→confirmed→checked_in→in_progress→done`、
  リクエスト: `requested→pending→confirmed→…`、各所から `cancelled`/`rejected`）。
- **ダブルブッキング防止は二重防御**: アプリ層（`Idempotency-Key` 冪等 ＋ 楽観ロック
  `version_no` ＋ `SELECT FOR UPDATE NOWAIT`）＋ DB 層（PostgreSQL `EXCLUDE USING gist`
  排他制約）。
- 予約ノートを論理削除する際は**必ず `status` を `cancelled` に**する
  （`confirmed` のままだと排他制約が枠をブロックし続ける）。
- note_type は **API では文字列コード（`note_type_code`）**、**DB では `note_type_id`**。
  DAO 層で変換。Be:note は `head` を親とする木構造。

### 旧仕様からの命名修正（戻さない）
旧 pptx/xlsx は破棄済み。次は確定済みの正。**「元に戻す」ことをしない**:
- `client_lank` → **`client_rank`**、`"allergy "`（末尾スペース）→ **`allergy`**
- 顧客 ID の `CID…`/`UID…` 文字列体系 → **UUID**
- `done_flg` → **`status` に統一**（`status='done'` 相当）
- スタッフの名前文字列参照 → **`staff_id`（UUID）参照**

---

## 6. 作業の進め方

- **設計書が正典**。仕様の根拠は `docs/`。迷ったら 4 文書を突き合わせる。
- 設計を変更するときは**関連する全文書を同時に更新**して整合を保つ。
- ドキュメント・コードコメント・PR は**日本語**で書く（チーム規約／`.gemini/styleguide.md`）。
- PR は Gemini Code Assist が自動レビューする（`.gemini/config.yaml`）。
- `web/` / `mobile/` の実装が入ったら、ビルド/テスト/lint コマンドを本節に追記し、
  Web セッション用の SessionStart フック（`session-start-hook` スキル）を整備すること。

---

## 7. 画面・API・データ早見表

| 画面 | URL | 権限 | 主な API |
|---|---|---|---|
| ログイン | `/login` | 未認証 | Supabase Auth |
| メニュー | `/menu` | staff/admin | — |
| 予約受付 | `/clerk` | staff/admin | `GET /reservations`（当日） |
| 予約ボード | `/board` | staff/admin | `GET /reservations`（来店中）, `PATCH …/task` |
| 予約管理 | `/reserve` | staff/admin | `GET /reservations`, `GET /availability`, `PUT …` |
| Be:note | `/be_note/{client_id}` | staff/admin/customer(自分) | `GET/POST /clients/{client_id}/notes` |
| 日報管理 | `/report` | admin | `GET /reports/daily` |
| 材料管理 | `/material` | admin | `GET/POST /materials…` |
| マスタメンテ | `/master` | admin | `GET/POST/PUT/DELETE /masters/{resource}` |

主要テーブル: `t_salon_group` / `t_salon` / `t_staff` / `t_client` / `t_client_salon` /
`t_be_note`（共通ヘッダ・木構造）/ `t_reservation` / `t_menu` / `t_sold_item` /
`t_discount` / `t_photo` / マスタ各種（`t_menu_master` / `t_task` / `t_note_type` /
`t_shift` / `t_business_hour` / `t_holiday` / `t_reservation_slot`）/ 材料
（`t_material` / `t_material_transaction`）。詳細は `docs/DB設計書.md`。
