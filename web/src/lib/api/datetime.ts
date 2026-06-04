/**
 * 日時ユーティリティ。DB は UTC（TIMESTAMPTZ）保存、業務日付は JST（UTC+9）。
 * 日付（YYYY-MM-DD）境界の JST→UTC 変換をここに集約する。
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 現在の JST 日付（YYYY-MM-DD）。 */
export function todayJst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** JST 日付の 00:00 を UTC ISO 文字列に。 */
export function jstDateStartUtc(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString();
}

/** JST 日付の翌日 00:00（= その日の排他的終端）を UTC ISO 文字列に。 */
export function jstDateEndExclusiveUtc(dateStr: string): string {
  const start = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}
