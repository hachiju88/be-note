import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // セッション更新のため getUser() を必ず呼ぶ（getSession() は使わない）
  // data が null になる可能性に備えてオプショナルチェイニングで取得する（#4 修正）
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  const { pathname } = request.nextUrl;

  // リダイレクト時にリフレッシュ済み Cookie を引き継ぐ（#2 修正）
  function redirectWithCookies(url: URL) {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      res.cookies.set(cookie),
    );
    return res;
  }

  // 未認証 → /login へリダイレクト
  if (!user && pathname !== "/login" && !pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url);
  }

  // 認証済みで /login（?error なし）→ /menu へリダイレクト
  // ?error がある場合はリダイレクトしない（customer エラー表示のため）
  if (
    user &&
    pathname === "/login" &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    return redirectWithCookies(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
