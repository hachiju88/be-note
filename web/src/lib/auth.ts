import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 認証・ロール解決の共通ヘルパー（Server 専用）。
 *
 * ロールの正典は DB。JWT の `sub`（= auth.users.id）を
 * `t_staff.user_id` と突合し、`t_staff.is_admin` から admin を導出する。
 * （CLAUDE.md: 権限は t_staff.is_admin から導出。職位 position とは独立）
 */

export type Role = "admin" | "staff" | "customer";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: Role;
  /** staff / admin の場合のスタッフ ID（customer は null）。 */
  staffId: string | null;
  salonId: string | null;
};

/**
 * 現在のユーザーのロールを含む認証コンテキストを返す。
 * 未認証の場合は null。
 *
 * staff として登録（t_staff に user_id が存在）されていれば staff/admin、
 * そうでなければ customer 扱い。
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // staff レコードを引き、権限（is_admin）を導出する。
  const { data: staff, error: staffError } = await supabase
    .from("t_staff")
    .select("staff_id, salon_id, is_admin")
    .eq("user_id", user.id)
    .eq("delete_flg", false)
    .maybeSingle();

  if (staffError) {
    // DB エラーをサイレントに無視すると、スタッフが誤って customer 扱いされる。
    // エラーをログし、呼び出し元がハンドリングできるよう例外を投げる。
    console.error("[auth] t_staff 取得失敗:", staffError);
    throw new Error("認証情報の取得に失敗しました。");
  }

  if (staff) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: staff.is_admin ? "admin" : "staff",
      staffId: staff.staff_id,
      salonId: staff.salon_id,
    };
  }

  // staff でなければ customer（自分の Be:note のみ閲覧可）。
  return {
    userId: user.id,
    email: user.email ?? null,
    role: "customer",
    staffId: null,
    salonId: null,
  };
}

/**
 * 認証必須ガード。未認証なら /login へリダイレクト。
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * staff 以上（staff / admin）必須ガード。
 * 未認証 → /login、customer → /login?error=forbidden へ退避。
 */
export async function requireStaff(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role === "customer") {
    redirect("/login?error=forbidden");
  }
  return ctx;
}

/**
 * admin 必須ガード。admin 以外は /menu へ退避。
 */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireStaff();
  if (ctx.role !== "admin") {
    redirect("/menu");
  }
  return ctx;
}
