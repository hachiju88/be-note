import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { optionalDateString } from "@/lib/api/validate";
import {
  jstDateEndExclusiveUtc,
  jstDateStartUtc,
  todayJst,
} from "@/lib/api/datetime";
import { fetchStaffNames } from "@/lib/api/staff";

const PAYMENT_METHODS = ["cash", "card", "qr"] as const;

/**
 * GET /api/v1/reports/daily — 日報（期間集計・admin）。
 * 会計済み（status='done'）の予約を対象に、売上・客数・支払内訳・スタッフ別・
 * メニュー別を集計する。スタッフ別/メニュー別は t_menu を集計元とする（設計書）。
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
    const startUtc = jstDateStartUtc(dateFrom);
    const endUtc = jstDateEndExclusiveUtc(dateTo);

    // 会計済み予約・キャンセル数・ノーショー数を並行取得（いずれも自サロン・
    // 論理削除されていない予約・reservation_start が範囲内）。
    const [doneRes, cancelledRes, noShowRes] = await Promise.all([
      svc
        .from("t_reservation")
        .select("note_id, total, payment_method, t_be_note!inner(delete_flg)")
        .eq("salon_id", auth.salonId)
        .eq("t_be_note.delete_flg", false)
        .eq("status", "done")
        .gte("reservation_start", startUtc)
        .lt("reservation_start", endUtc),
      svc
        .from("t_reservation")
        .select("note_id, t_be_note!inner(delete_flg)", {
          count: "exact",
          head: true,
        })
        .eq("salon_id", auth.salonId)
        .eq("t_be_note.delete_flg", false)
        .eq("status", "cancelled")
        .gte("reservation_start", startUtc)
        .lt("reservation_start", endUtc),
      svc
        .from("t_reservation")
        .select("note_id, t_be_note!inner(delete_flg)", {
          count: "exact",
          head: true,
        })
        .eq("salon_id", auth.salonId)
        .eq("t_be_note.delete_flg", false)
        .eq("no_show_flg", true)
        .gte("reservation_start", startUtc)
        .lt("reservation_start", endUtc),
    ]);
    if (doneRes.error || cancelledRes.error || noShowRes.error) {
      throw new ApiError("INTERNAL_ERROR", "予約集計の取得に失敗しました。");
    }
    const done = doneRes.data ?? [];

    // 売上・客数・支払内訳。
    let salesTotal = 0;
    const payment = new Map<string, number>();
    for (const r of done) {
      const total = (r.total as number | null) ?? 0;
      salesTotal += total;
      if (r.payment_method) {
        payment.set(
          r.payment_method,
          (payment.get(r.payment_method) ?? 0) + total,
        );
      }
    }
    const customerCount = done.length;

    // スタッフ別・メニュー別は t_menu を集計元とする。
    const noteIds = done.map((r) => r.note_id);
    const byStaff = new Map<string, { sales: number; count: number }>();
    const byMenu = new Map<string, { count: number; sales: number }>();
    if (noteIds.length > 0) {
      const { data: menus, error } = await svc
        .from("t_menu")
        .select("staff_id, menu_name, price")
        .in("note_id", noteIds);
      if (error) {
        throw new ApiError("INTERNAL_ERROR", "施術明細の取得に失敗しました。");
      }
      for (const m of menus ?? []) {
        const price = (m.price as number | null) ?? 0;
        const s = byStaff.get(m.staff_id) ?? { sales: 0, count: 0 };
        s.sales += price;
        s.count += 1;
        byStaff.set(m.staff_id, s);
        const mn = byMenu.get(m.menu_name) ?? { count: 0, sales: 0 };
        mn.count += 1;
        mn.sales += price;
        byMenu.set(m.menu_name, mn);
      }
    }

    const staffNames = await fetchStaffNames(svc, [...byStaff.keys()]);

    return ok({
      period: { date_from: dateFrom, date_to: dateTo },
      summary: {
        sales_total: salesTotal,
        customer_count: customerCount,
        average_spend: customerCount
          ? Math.round(salesTotal / customerCount)
          : 0,
        cancel_count: cancelledRes.count ?? 0,
        no_show_count: noShowRes.count ?? 0,
      },
      payment_breakdown: PAYMENT_METHODS.filter((m) => payment.has(m)).map(
        (m) => ({ method: m, amount: payment.get(m) ?? 0 }),
      ),
      by_staff: [...byStaff.entries()].map(([staffId, v]) => ({
        staff_id: staffId,
        staff_name: staffNames.get(staffId) ?? null,
        sales: v.sales,
        treatment_count: v.count,
      })),
      by_menu: [...byMenu.entries()].map(([menuName, v]) => ({
        menu_name: menuName,
        count: v.count,
        sales: v.sales,
      })),
    });
  },
  { roles: ["admin"] },
);
