import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ（Client Component）用 Supabase クライアント。
 * 公開可能な anon key を使用し、認証は Cookie に保持される。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
