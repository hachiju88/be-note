import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * グローバル Proxy（旧 middleware。Next.js 16 で proxy へ改称された）。
 *
 * 役割:
 * 1. Supabase セッション Cookie の更新（トークンリフレッシュ）。
 * 2. 未認証ユーザーの保護ルートアクセスを `/login` へリダイレクト。
 * 3. 認証済みユーザーの `/login` アクセスを `/menu` へリダイレクト。
 *
 * ロール（staff / admin）の細かいガードは DB 参照が必要なため
 * 各 Route Group の layout（Server Component）で行う。proxy は
 * 「ログインしているか」までを担保する。
 */

// 認証不要で到達できるパス（プレフィックス一致）。
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // セッション更新で書き換わった Cookie をリダイレクトレスポンスへ引き継ぐ
  // ヘルパー。新規 NextResponse.redirect() は response の Cookie を引き継がない
  // ため、手動でコピーする必要がある。
  function redirectWithCookies(url: URL): NextResponse {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie);
    });
    return res;
  }

  // 未認証で保護ルートにアクセス → /login へ。
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // ログイン後に元のページへ戻すための next パラメータ。
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url);
  }

  // 認証済みで /login にアクセス → メニューへ。
  // ただし error パラメータがある場合（customer がアクセス拒否された場合など）は
  // リダイレクトしない。しなければ /menu → /login?error=forbidden → /menu の
  // 無限ループが発生する。
  if (
    user &&
    pathname === "/login" &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    url.search = "";
    return redirectWithCookies(url);
  }

  return response;
}

export const config = {
  // 静的アセット・画像最適化・favicon を除く全ルートに適用。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
