import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/url";

/**
 * OAuth コールバック（/auth/callback）。
 * Supabase から戻ってきた認可コードをセッションに交換し、next へリダイレクトする。
 *
 * customer（t_staff に存在しないユーザー）はサインアウトして弾く。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // オープンリダイレクト防止: 自サイト内パスのみ許可（"//" "/\" を拒否）。
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // t_staff に存在しない customer は管理ツール不可のためサインアウトして弾く。
      const { data: staff } = await supabase
        .from("t_staff")
        .select("is_admin")
        .eq("user_id", data.user.id)
        .eq("delete_flg", false)
        .maybeSingle();

      if (!staff) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=forbidden`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
