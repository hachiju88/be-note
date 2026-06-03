/**
 * birthday（YYYY-MM-DD）から満年齢を算出する。DB には保存せずレスポンス時に計算する
 * （docs/API設計書.md「顧客情報取得」）。基準日は JST。
 */
export function calcAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  if (!m) return null;
  const by = Number(m[1]);
  const bm = Number(m[2]);
  const bd = Number(m[3]);

  // 現在日付を JST で求める（UTC+9）。
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const cy = jst.getUTCFullYear();
  const cm = jst.getUTCMonth() + 1;
  const cd = jst.getUTCDate();

  let age = cy - by;
  if (cm < bm || (cm === bm && cd < bd)) age--;
  return age >= 0 ? age : null;
}
