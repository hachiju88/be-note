import { getBearerToken } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
if (!API_BASE) {
  console.error(
    "[apiFetch] EXPO_PUBLIC_API_BASE_URL が未設定です。mobile/.env.local を確認してください。",
  );
}

/**
 * /api/v1 への認証付き fetch ラッパー（モバイル用）。
 * Bearer JWT を SecureStore 経由で取得して Authorization ヘッダに付与する。
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getBearerToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

/** JST 当日 YYYY-MM-DD。 */
export function todayJst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** UTC ISO → JST "YYYY-MM-DD HH:MM"。 */
export function toJstDatetime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** UUID v4（オフライン作成用フォールバック）。UUIDv7 実装は将来追加予定。 */
export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
