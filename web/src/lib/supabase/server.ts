import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバ（Server Component / Route Handler / Server Action）用 Supabase クライアント。
 * Next.js 16 では cookies() は非同期のため await する。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component からの呼び出しでは set できない。
            // セッション更新は middleware 側で行う想定（実装フェーズで追加）。
          }
        },
      },
    },
  );
}
