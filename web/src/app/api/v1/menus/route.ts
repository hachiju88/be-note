import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";

/**
 * GET /api/v1/menus — 有効メニュー一覧（customer / staff / admin 共通）。
 * customer ロールでは t_client_salon 経由で salon_id を解決する。
 * 予約リクエスト申込フォームでのメニュー選択に使用する。
 */
export const GET = apiRoute(
  async ({ auth, svc }) => {
    let salonId = auth.salonId;

    if (!salonId && auth.clientId) {
      const { data } = await svc
        .from("t_client_salon")
        .select("salon_id")
        .eq("client_id", auth.clientId)
        .limit(1)
        .maybeSingle();
      salonId = data?.salon_id ?? null;
    }

    if (!salonId) {
      throw new ApiError("FORBIDDEN", "サロン情報が取得できません。");
    }

    const { data, error } = await svc
      .from("t_menu_master")
      .select("menu_master_id, menu_name, base_price, duration_minutes")
      .eq("salon_id", salonId)
      .eq("delete_flg", false)
      .order("menu_name");

    if (error) throw new ApiError("INTERNAL_ERROR", "メニューの取得に失敗しました。");
    return ok(data ?? []);
  },
  { roles: ["customer", "staff", "admin"] },
);
