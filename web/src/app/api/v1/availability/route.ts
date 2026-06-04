import type { SupabaseClient } from "@supabase/supabase-js";
import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { assertUuid, optionalDateString } from "@/lib/api/validate";
import { jstDateEndExclusiveUtc, jstDateStartUtc } from "@/lib/api/datetime";
import { fetchStaffNames } from "@/lib/api/staff";
import {
  generateSlots,
  intersect,
  parseTimeToMin,
  subtractIntervals,
  type Interval,
} from "@/lib/api/availability";

const BUSY_STATUSES = ["confirmed", "checked_in", "in_progress"];

/**
 * GET /api/v1/availability — 空き時間取得（all）。
 * 営業時間 ∩ スタッフシフト − 既存予約 から、メニュー所要時間が収まる 15 分刻みの
 * スロットを算出（docs/予約ロジック設計書.md）。
 * 指名なし customer には時間スロットのみ、指名あり/staff/admin にはスタッフ別に返す。
 */
export const GET = apiRoute(
  async ({ req, auth, svc }) => {
    const { searchParams } = new URL(req.url);
    const date = optionalDateString(searchParams.get("date"), "date");
    if (!date) throw new ApiError("INVALID_PARAMS", "date は必須です。");
    const menuMasterId = searchParams.get("menu_master_id");
    if (!menuMasterId) {
      throw new ApiError("INVALID_PARAMS", "menu_master_id は必須です。");
    }
    assertUuid(menuMasterId, "menu_master_id");
    const staffId = searchParams.get("staff_id");
    if (staffId) assertUuid(staffId, "staff_id");

    // メニューから所要時間とサロンを取得（customer は salon を持たないためここで決定）。
    const { data: menu, error: menuError } = await svc
      .from("t_menu_master")
      .select("salon_id, duration_minutes")
      .eq("menu_master_id", menuMasterId)
      .eq("delete_flg", false)
      .maybeSingle();
    if (menuError) throw new ApiError("INTERNAL_ERROR", "メニューの取得に失敗しました。");
    if (!menu) throw new ApiError("INVALID_PARAMS", "menu_master_id が存在しません。");
    // staff/admin は自サロンのメニューのみ照会可（他サロンメニュー指定を拒否）。
    if (auth.salonId && menu.salon_id !== auth.salonId) {
      throw new ApiError("FORBIDDEN", "他のサロンのメニューは指定できません。");
    }
    const salonId = auth.salonId ?? menu.salon_id;
    const durationMin = menu.duration_minutes as number;

    // 定休日・臨時休業なら空き 0。
    const { data: holiday, error: holidayError } = await svc
      .from("t_holiday")
      .select("holiday_date")
      .eq("salon_id", salonId)
      .eq("holiday_date", date)
      .maybeSingle();
    if (holidayError) throw new ApiError("INTERNAL_ERROR", "休日の取得に失敗しました。");
    if (holiday) return ok(emptyResponse(auth.role, staffId));

    // 営業時間（曜日別）。無ければ休業日扱い。
    const dow = weekdayOf(date);
    const { data: bh, error: bhError } = await svc
      .from("t_business_hour")
      .select("open_time, close_time")
      .eq("salon_id", salonId)
      .eq("day_of_week", dow)
      .maybeSingle();
    if (bhError) throw new ApiError("INTERNAL_ERROR", "営業時間の取得に失敗しました。");
    if (!bh) return ok(emptyResponse(auth.role, staffId));
    const business: Interval = {
      start: parseTimeToMin(bh.open_time),
      end: parseTimeToMin(bh.close_time),
    };

    const midnightMs = Date.parse(jstDateStartUtc(date));

    // 対象日のシフト・既存予約を取得（staff_id 指定時は絞り込み）。
    const [shiftsByStaff, busyByStaff] = await Promise.all([
      fetchShifts(svc, date, staffId),
      fetchBusy(svc, salonId, date, midnightMs, staffId),
    ]);

    const staffIds = [...shiftsByStaff.keys()];
    const names = await fetchStaffNames(svc, staffIds);

    const perStaff = staffIds.map((sid) => {
      let free: Interval[] = [];
      for (const shift of shiftsByStaff.get(sid) ?? []) {
        const inShift = intersect(business, shift);
        if (inShift) {
          free = free.concat(
            subtractIntervals([inShift], busyByStaff.get(sid) ?? []),
          );
        }
      }
      const slots = generateSlots(free, durationMin).map((iv) => ({
        start: new Date(midnightMs + iv.start * 60_000).toISOString(),
        end: new Date(midnightMs + iv.end * 60_000).toISOString(),
      }));
      return { staff_id: sid, staff_name: names.get(sid) ?? null, slots };
    });

    // 指名なし customer は時間スロットのみ（スタッフ横断で start を統合）。
    if (auth.role === "customer" && !staffId) {
      const byStart = new Map<string, { start: string; end: string }>();
      for (const s of perStaff) {
        for (const slot of s.slots) byStart.set(slot.start, slot);
      }
      const slots = [...byStart.values()].sort((a, b) =>
        a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
      );
      return ok([{ slots }]);
    }

    return ok(perStaff);
  },
  { roles: ["staff", "admin", "customer"] },
);

/** 休業時の空レスポンス（ロール／指名有無で形を合わせる）。 */
function emptyResponse(role: string, staffId: string | null) {
  if (role === "customer" && !staffId) return [{ slots: [] }];
  return [];
}

/** カレンダー日付（YYYY-MM-DD）の曜日（0=日..6=土）。 */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 対象日のシフトを staff_id ごとの分区間にまとめる。 */
async function fetchShifts(
  svc: SupabaseClient,
  date: string,
  staffId: string | null,
): Promise<Map<string, Interval[]>> {
  let q = svc
    .from("t_shift")
    .select("staff_id, start_time, end_time")
    .eq("shift_date", date)
    .eq("delete_flg", false);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw new ApiError("INTERNAL_ERROR", "シフトの取得に失敗しました。");
  const map = new Map<string, Interval[]>();
  for (const s of data ?? []) {
    const list = map.get(s.staff_id) ?? [];
    list.push({
      start: parseTimeToMin(s.start_time),
      end: parseTimeToMin(s.end_time),
    });
    map.set(s.staff_id, list);
  }
  return map;
}

/** 対象日の confirmed 以上の予約を staff_id ごとの busy 区間（分）にまとめる。 */
async function fetchBusy(
  svc: SupabaseClient,
  salonId: string,
  date: string,
  midnightMs: number,
  staffId: string | null,
): Promise<Map<string, Interval[]>> {
  let q = svc
    .from("t_reservation")
    .select(
      "staff_id, reservation_start, reservation_end, t_be_note!inner(delete_flg)",
    )
    .eq("salon_id", salonId)
    .eq("t_be_note.delete_flg", false)
    .in("status", BUSY_STATUSES)
    // 当日と重なる予約（前日跨ぎ／翌日跨ぎ含む）を区間重複で取得する。
    .lt("reservation_start", jstDateEndExclusiveUtc(date))
    .gt("reservation_end", jstDateStartUtc(date));
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw new ApiError("INTERNAL_ERROR", "予約の取得に失敗しました。");
  const map = new Map<string, Interval[]>();
  for (const r of data ?? []) {
    const list = map.get(r.staff_id) ?? [];
    list.push({
      start: Math.round((Date.parse(r.reservation_start) - midnightMs) / 60_000),
      end: Math.round((Date.parse(r.reservation_end) - midnightMs) / 60_000),
    });
    map.set(r.staff_id, list);
  }
  return map;
}
