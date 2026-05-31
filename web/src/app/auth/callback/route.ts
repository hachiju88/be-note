import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/url";

/**
 * OAuth コールバック（/auth/callback）。
 * Supabase から戻ってきた認可コードをセッションに交換し、next へリダイレクトする。
 *
 * このパスは proxy の PUBLIC_PATHS（/auth）に含めて未認証アクセスを許可している。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // オープンリダイレクト防止: 自サイト内パスのみ許可（"//" "/\" を拒否）。
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
