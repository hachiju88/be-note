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

/**
 * UUID v7（時刻順ソート可能・オフライン作成対応）。
 * 上位 48 bit = Unix タイムスタンプ ms、version=7、variant=10、残り乱数。
 */
export function generateUuid(): string {
  const now = Date.now();
  const rand = new Uint8Array(10);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < rand.length; i++) rand[i] = (Math.random() * 256) | 0;
  }
  const b = new Uint8Array(16);
  // 48-bit timestamp (big-endian)
  b[0] = Math.floor(now / 0x10000000000) & 0xff;
  b[1] = Math.floor(now / 0x100000000) & 0xff;
  b[2] = Math.floor(now / 0x1000000) & 0xff;
  b[3] = Math.floor(now / 0x10000) & 0xff;
  b[4] = Math.floor(now / 0x100) & 0xff;
  b[5] = now & 0xff;
  b[6] = 0x70 | (rand[0] & 0x0f); // version 7
  b[7] = rand[1];
  b[8] = 0x80 | (rand[2] & 0x3f); // variant 10xx
  b[9] = rand[3];
  b[10] = rand[4]; b[11] = rand[5]; b[12] = rand[6];
  b[13] = rand[7]; b[14] = rand[8]; b[15] = rand[9];
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
