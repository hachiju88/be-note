---
name: design-check
description: Be:note の設計書4本（画面/API/DB/予約ロジック）の整合性をチェックする。テーブル名・カラム名・エンドポイント・status・note_type が文書間で一致しているか、壊れた相互参照がないかを検査する。設計書を編集した後、実装が設計書とズレていないか確認したいとき、PR 前のセルフレビューに使う。
---

# 設計整合性チェック（design-check）

Be:note は仕様の正典が `docs/` の Markdown 設計書4本で、**文書間の整合性が最重要**。
このスキルはその整合性を機械的・体系的に点検する。`.gemini/styleguide.md` のレビュー
観点を手元（実装中・PR前）で回せるようにしたもの。

## 対象文書

- `docs/画面設計書.md`
- `docs/API設計書.md`
- `docs/DB設計書.md`
- `docs/予約ロジック設計書.md`

実装が始まっていれば `supabase/migrations/`（DDL）・`web/`・`mobile/` も突き合わせる。

## チェック手順

1. 4文書（＋実装があれば migrations）を読み込む。
2. 以下の語彙を文書横断で抽出し、表記ゆれ・不一致・片側更新を洗い出す。
   - **テーブル名**（`t_` プレフィックス）と**カラム名**
   - **API エンドポイント**（メソッド＋パス、`{note_id}` 等のパスパラメータ名）
   - **status 値**（`draft`/`requested`/`pending`/`confirmed`/`checked_in`/`in_progress`/`done`/`rejected`/`cancelled`）と状態遷移
   - **note_type**（API=`note_type_code` 文字列 / DB=`note_type_id` 数値、`head`/`reservation`/`item`/`discount`/`photo`/`text`）
   - **ロール**（`customer`/`staff`/`admin`）と各エンドポイントの権限
3. 設計規約への違反を確認する。
   - PK は全テーブル UUID（例外は `t_note_type` の `SMALLINT` のみ）
   - 論理削除 `delete_flg`。物理削除は `t_staff_skill`/`t_business_hour`/`t_holiday` のみ
   - 日時は `TIMESTAMPTZ`・UTC 保存／ISO 8601 UTC で授受
   - 権限は `is_admin`、職位 `position`（stylist/assistant）と**混同していないか**
   - ロール別フィールドマスク（customer に施術時間等を返していないか）
   - ダブルブッキング防止（冪等キー＋`version_no`＋`EXCLUDE` 制約）の記述整合
   - 論理削除時に `status='cancelled'` にする記述があるか
4. **旧仕様への逆戻り**がないか（戻したら指摘）。
   - `client_lank`（→`client_rank`）、`"allergy "` 末尾スペース、`CID`/`UID` 文字列ID（→UUID）、
     `done_flg`（→`status`）、スタッフ名の文字列参照（→`staff_id`）
5. **壊れた相互参照**（存在しない見出し・ファイルへの参照）を確認する。

## 出力フォーマット

重大度順に箇条書きで報告する。日本語。

- 🔴 **実害あり（不整合）**: 文書間で定義が食い違う／規約違反。該当ファイル・行・該当語を明示。
- 🟡 **要確認**: 片側にしか無い・記述が曖昧。
- 🔵 **軽微**: 表記ゆれ・Markdown 崩れ。

各指摘に「どう直すと整合するか」を1文添える。修正は勝手に行わず、指摘に留める
（修正を頼まれたら**関連する全文書を同時に**直して整合を保つ）。
