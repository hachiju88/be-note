import { ApiError } from "./errors";
import type { ApiAuthContext } from "./auth";

/**
 * 顧客リソースへのアクセス可否を判定する。
 * staff / admin は全顧客可。customer は「自分のみ」（JWT 由来の clientId と一致）に限定する
 * （docs/API設計書.md「認証」customer の自分のみポリシー）。
 */
export function assertClientAccess(
  auth: ApiAuthContext,
  clientId: string,
): void {
  if (auth.role === "customer" && auth.clientId !== clientId) {
    throw new ApiError("FORBIDDEN", "自分の Be:note のみ参照できます。");
  }
}
