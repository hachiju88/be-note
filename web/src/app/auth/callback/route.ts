import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth コールバック（/auth/callback）。
 * Supabase から戻ってきた認可コードをセッションに交換し、next へリダイレクトする。
 *
 * このパスは middleware の PUBLIC_PATHS（/auth）に含めて未認証アクセスを許可している。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/menu";
  // オープンリダイレクト防止: 自サイト内パスのみ許可。
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/menu";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
