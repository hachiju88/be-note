import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";

export type ApiRole = "admin" | "staff" | "customer";

export type ApiAuthContext = {
  userId: string;
  role: ApiRole;
  /** staff/admin のときのスタッフ ID。 */
  staffId: string | null;
  /** customer のときの顧客 ID（「自分のみ」判定に使用）。 */
  clientId: string | null;
  /** staff/admin の所属サロン（MVP は 1 店舗）。 */
  salonId: string | null;
};

/**
 * Authorization: Bearer <JWT> を検証し、ロールと本人特定情報を返す。
 *
 * - JWT は anon クライアントの getUser() で Auth サーバ検証する。
 * - ロールは t_staff.is_admin から導出（true→admin / false→staff）。
 *   staff でなければ t_client を引いて customer 扱い（自分の client_id を保持）。
 * - 突合は service_role クライアント（svc）で行う（RLS バイパス）。
 */
export async function authenticate(
  req: Request,
  svc: SupabaseClient,
): Promise<ApiAuthContext> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new ApiError("UNAUTHORIZED", "認証トークンがありません。");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ApiError("INTERNAL_ERROR", "Supabase 環境変数が未設定です。");
  }

  const anon = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user) {
    throw new ApiError("UNAUTHORIZED", "トークンが無効または期限切れです。");
  }

  const { data: staff } = await svc
    .from("t_staff")
    .select("staff_id, salon_id, is_admin")
    .eq("user_id", user.id)
    .eq("delete_flg", false)
    .maybeSingle();

  if (staff) {
    return {
      userId: user.id,
      role: staff.is_admin ? "admin" : "staff",
      staffId: staff.staff_id,
      clientId: null,
      salonId: staff.salon_id,
    };
  }

  const { data: client } = await svc
    .from("t_client")
    .select("client_id")
    .eq("user_id", user.id)
    .eq("delete_flg", false)
    .maybeSingle();

  return {
    userId: user.id,
    role: "customer",
    staffId: null,
    clientId: client?.client_id ?? null,
    salonId: null,
  };
}
