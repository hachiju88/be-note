import { createClient } from "@/lib/supabase/client";

/**
 * クライアントコンポーネントから /api/v1 を呼ぶ共通 fetch。
 * Supabase ブラウザクライアントからセッショントークンを取り出し
 * Authorization: Bearer ヘッダに付与する。
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  return fetch(path, { ...init, headers });
}

/** JST 当日の YYYY-MM-DD 文字列（クライアント側）。 */
export function todayJst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** UTC ISO 文字列を JST の HH:MM に変換する。 */
export function toJstTime(isoUtc: string): string {
  const jst = new Date(new Date(isoUtc).getTime() + 9 * 60 * 60 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

/** UTC ISO 文字列を JST の "YYYY-MM-DD HH:MM" に変換する。 */
export function toJstDatetime(isoUtc: string): string {
  const jst = new Date(new Date(isoUtc).getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}
