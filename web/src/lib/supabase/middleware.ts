import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * middleware 用 Supabase クライアントの生成とセッション更新。
 *
 * - リクエストの Cookie からセッションを読み、必要なら更新したトークンを
 *   レスポンス Cookie に書き戻す（@supabase/ssr の推奨パターン）。
 * - `getUser()` を必ず呼んでトークンを検証・リフレッシュする。
 *
 * 返り値の `user` を使って middleware 側でリダイレクト判定を行う。
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() を呼ぶことで Auth サーバ側でトークンを検証・リフレッシュする。
  // （getSession() は Cookie の値を信用するだけなので middleware では使わない）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
