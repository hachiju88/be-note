import { type NextRequest, type NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, toErrorResponse } from "./errors";
import { authenticate, type ApiAuthContext, type ApiRole } from "./auth";
import { createServiceClient } from "@/lib/supabase/service";

export type ApiContext<P> = {
  req: NextRequest;
  auth: ApiAuthContext;
  svc: SupabaseClient;
  params: P;
};

type Handler<P> = (ctx: ApiContext<P>) => Promise<NextResponse> | NextResponse;

/**
 * /api/v1 ルートの共通ラッパー。
 *
 *   Bearer 認証 → ロールガード（roles 指定時）→ ハンドラ実行
 *   例外は共通エラーレスポンス { error: { code, message } } に変換する。
 *
 * service_role で RLS をバイパスするため、認可は roles と各ハンドラ内の
 * 本人性チェック（customer の「自分のみ」等）で必ず行うこと。
 */
export function apiRoute<P = Record<string, never>>(
  handler: Handler<P>,
  opts: { roles?: ApiRole[] } = {},
): (
  req: NextRequest,
  segment: { params: Promise<P> },
) => Promise<NextResponse> {
  return async (req, segment) => {
    try {
      const svc = createServiceClient();
      const auth = await authenticate(req, svc);
      if (opts.roles && !opts.roles.includes(auth.role)) {
        throw new ApiError("FORBIDDEN", "この操作を行う権限がありません。");
      }
      const params = segment?.params ? await segment.params : ({} as P);
      return await handler({ req, auth, svc, params });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
