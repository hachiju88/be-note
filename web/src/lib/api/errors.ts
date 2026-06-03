import { NextResponse } from "next/server";

/**
 * API 共通エラー。`code` は docs/API設計書.md「エラーレスポンス」の一覧に対応する。
 * レスポンス形は { "error": { "code", "message" } }。
 */
export type ApiErrorCode =
  | "INVALID_PARAMS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DOUBLE_BOOKING"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_PARAMS: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DOUBLE_BOOKING: 409,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
  }
}

/** 例外を共通エラーレスポンスに変換する。ApiError 以外は INTERNAL_ERROR に丸める。 */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.status },
    );
  }
  console.error("[api] 未捕捉エラー:", e);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "サーバ内部エラーが発生しました。",
      },
    },
    { status: 500 },
  );
}
