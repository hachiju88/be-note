import { ApiError } from "./errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** リクエストボディを JSON オブジェクトとして取り出す。不正なら INVALID_PARAMS。 */
export async function parseJsonObject(
  req: Request,
): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("INVALID_PARAMS", "リクエストボディの JSON が不正です。");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ApiError(
      "INVALID_PARAMS",
      "リクエストボディはオブジェクトで指定してください。",
    );
  }
  return raw as Record<string, unknown>;
}

/** 必須文字列（空文字不可、前後空白は除去、任意で最大文字数チェック）。 */
export function requireString(
  v: unknown,
  field: string,
  maxLength?: number,
): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new ApiError("INVALID_PARAMS", `${field} は必須です。`);
  }
  const s = v.trim();
  if (maxLength !== undefined && s.length > maxLength) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${maxLength} 文字以内で指定してください。`,
    );
  }
  return s;
}

/** 任意文字列（未指定/null は null、前後空白は除去、任意で最大文字数チェック）。 */
export function optionalString(
  v: unknown,
  field: string,
  maxLength?: number,
): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") {
    throw new ApiError("INVALID_PARAMS", `${field} は文字列で指定してください。`);
  }
  const s = v.trim();
  if (maxLength !== undefined && s.length > maxLength) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${maxLength} 文字以内で指定してください。`,
    );
  }
  return s;
}

/** 任意の日付文字列（YYYY-MM-DD・実在日）。DB の date 型違反による 500 を防ぐ。 */
export function optionalDateString(v: unknown, field: string): string | null {
  const val = optionalString(v, field);
  if (!val) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は YYYY-MM-DD 形式で指定してください。`,
    );
  }
  // 実在日チェック（例: 2026-02-31 を弾く）。
  const [y, m, d] = val.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new ApiError("INVALID_PARAMS", `${field} に有効な日付を指定してください。`);
  }
  return val;
}

/** 性別（1=男性 / 2=女性）。t_client.check_client_sex に対応。 */
export function requireSex(v: unknown): 1 | 2 {
  if (v !== 1 && v !== 2) {
    throw new ApiError(
      "INVALID_PARAMS",
      "sex は 1(男性) または 2(女性) で指定してください。",
    );
  }
  return v;
}

/** パスパラメータ等の UUID 形式チェック（非 UUID で DB クエリ 500 になるのを防ぐ）。 */
export function assertUuid(v: string, field: string): string {
  if (!UUID_RE.test(v)) {
    throw new ApiError("INVALID_PARAMS", `${field} の形式が不正です。`);
  }
  return v;
}

/** 必須 UUID（本文値）。 */
export function requireUuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) {
    throw new ApiError("INVALID_PARAMS", `${field} は UUID で指定してください。`);
  }
  return v;
}

/** 任意 UUID（未指定/null/空は null）。 */
export function optionalUuid(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) {
    throw new ApiError("INVALID_PARAMS", `${field} は UUID で指定してください。`);
  }
  return v;
}

/** 必須 ISO 8601 日時。元の文字列を返す（DB 側で timestamptz にキャスト）。 */
export function requireIsoDatetime(v: unknown, field: string): string {
  const s = requireString(v, field);
  if (Number.isNaN(Date.parse(s))) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ISO 8601 日時で指定してください。`,
    );
  }
  return s;
}

/** 必須整数（任意で下限チェック）。 */
export function requireInt(v: unknown, field: string, min?: number): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ApiError("INVALID_PARAMS", `${field} は整数で指定してください。`);
  }
  if (min !== undefined && v < min) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${min} 以上で指定してください。`,
    );
  }
  return v;
}

/** 必須数値（小数可。任意で下限チェック）。 */
export function requireNumber(v: unknown, field: string, min?: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ApiError("INVALID_PARAMS", `${field} は数値で指定してください。`);
  }
  if (min !== undefined && v < min) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${min} 以上で指定してください。`,
    );
  }
  return v;
}

/** 必須真偽値。 */
export function requireBoolean(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") {
    throw new ApiError("INVALID_PARAMS", `${field} は true / false で指定してください。`);
  }
  return v;
}

/** 列挙（許容値のいずれか）。 */
export function requireEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${allowed.join(" / ")} のいずれかで指定してください。`,
    );
  }
  return v as T;
}

/** 整数範囲（min..max 両端含む）。 */
export function requireIntInRange(
  v: unknown,
  field: string,
  min: number,
  max: number,
): number {
  const n = requireInt(v, field);
  if (n < min || n > max) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は ${min}〜${max} で指定してください。`,
    );
  }
  return n;
}

/** 時刻文字列（HH:MM または HH:MM:SS）。 */
export function requireTime(v: unknown, field: string): string {
  const s = requireString(v, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は HH:MM または HH:MM:SS で指定してください。`,
    );
  }
  return s;
}
