import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { optionalDateString } from "@/lib/api/validate";
import {
  jstDateEndExclusiveUtc,
  jstDateStartUtc,
  todayJst,
} from "@/lib/api/datetime";

type DailyReport = {
  sales_total: number;
  customer_count: number;
  cancel_count: number;
  no_show_count: number;
  payment_breakdown: { method: string; amount: number }[];
  by_staff: {
    staff_id: string;
    staff_name: string | null;
    sales: number;
    treatment_count: number;
  }[];
  by_menu: {
    menu_master_id: string | null;
    menu_name: string;
    count: number;
    sales: number;
  }[];
};

/**
 * GET /api/v1/reports/daily — 日報（期間集計・admin）。
 * 集計は DB 関数 report_daily（SQL GROUP BY）に委譲する。アプリ層で全行を
 * ロードしないため、PostgREST の行数上限（max_rows）による打ち切りを受けない。
 * date_from/date_to は JST 日付として UTC 範囲に変換して reservation_start で絞る。
 */
export const GET = apiRoute(
  async ({ req, auth, svc }) => {
    if (!auth.salonId) {
      throw new ApiError("INTERNAL_ERROR", "サロン情報が取得できません。");
    }
    const sp = new URL(req.url).searchParams;
    const dateFrom =
      optionalDateString(sp.get("date_from"), "date_from") ?? todayJst();
    const dateTo = optionalDateString(sp.get("date_to"), "date_to") ?? dateFrom;
    if (dateFrom > dateTo) {
      throw new ApiError(
        "INVALID_PARAMS",
        "date_from は date_to 以前の日付で指定してください。",
      );
    }

    const { data, error } = await svc.rpc("report_daily", {
      p_salon_id: auth.salonId,
      p_start_utc: jstDateStartUtc(dateFrom),
      p_end_utc: jstDateEndExclusiveUtc(dateTo),
    });
    if (error || !data) {
      throw new ApiError("INTERNAL_ERROR", "日報の集計に失敗しました。");
    }
    const agg = data as DailyReport;
    const customerCount = agg.customer_count ?? 0;

    return ok({
      period: { date_from: dateFrom, date_to: dateTo },
      summary: {
        sales_total: agg.sales_total ?? 0,
        customer_count: customerCount,
        average_spend: customerCount
          ? Math.round((agg.sales_total ?? 0) / customerCount)
          : 0,
        cancel_count: agg.cancel_count ?? 0,
        no_show_count: agg.no_show_count ?? 0,
      },
      payment_breakdown: agg.payment_breakdown ?? [],
      by_staff: agg.by_staff ?? [],
      by_menu: agg.by_menu ?? [],
    });
  },
  { roles: ["admin"] },
);
