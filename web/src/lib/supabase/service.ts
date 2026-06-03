import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * service_role クライアント（/api/v1 専用・サーバ限定）。
 *
 * RLS をバイパスするため、認可（ロール・本人性）と項目マスクは
 * API 層（呼び出し側）で必ず行うこと（docs/DB設計書.md「RLS」/ API設計書「認証」）。
 * SUPABASE_SERVICE_ROLE_KEY は秘匿（NEXT_PUBLIC_ を付けない）。
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service_role の環境変数が未設定です。");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
