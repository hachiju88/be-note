import { ApiError } from "./errors";

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

/** 必須文字列（空文字不可）。 */
export function requireString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new ApiError("INVALID_PARAMS", `${field} は必須です。`);
  }
  return v;
}

/** 任意文字列（未指定/null は null）。 */
export function optionalString(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") {
    throw new ApiError("INVALID_PARAMS", `${field} は文字列で指定してください。`);
  }
  return v;
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
