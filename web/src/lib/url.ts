/**
 * URL 関連の共通ユーティリティ。
 */

/**
 * リダイレクト先パスを検証する（オープンリダイレクト防止）。
 *
 * 自サイト内の絶対パス（`/` 始まり）のみ許可し、`//`（プロトコル相対 =
 * 外部扱い）は拒否する。不正な場合は fallback（既定 `/menu`）を返す。
 *
 * FormData 値（string | File | null）と素の string の両方を受けられる。
 */
export function safeInternalPath(
  value: string | File | null | undefined,
  fallback = "/menu",
): string {
  const path = typeof value === "string" ? value : "";
  // "//" はプロトコル相対URL（外部扱い）、"/\" は一部ブラウザが外部URLと解釈する。
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  )
    return path;
  return fallback;
}
