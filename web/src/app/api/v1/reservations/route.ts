import { apiRoute } from "@/lib/api/handler";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginated } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { assertUuid, optionalDateString } from "@/lib/api/validate";
import {
  jstDateEndExclusiveUtc,
  jstDateStartUtc,
  todayJst,
} from "@/lib/api/datetime";
import { assertReservationStatus } from "@/lib/api/reservation";
import { fetchStaffNames, staffRef } from "@/lib/api/staff";

/**
 * GET /api/v1/reservations — 予約一覧（staff / admin）。
 * date_from（既定: 当日）/ date_to / staff_id / status で絞り込み、reservation_start 昇順。
 * client は予約ノート（t_be_note）経由、staff は staff_id 経由で名前を付与する。
 */
export const GET = apiRoute(
  async ({ req, auth, svc }) => {
    if (!auth.salonId) {
      throw new ApiError("INTERNAL_ERROR", "サロン情報が取得できません。");
    }
    const { searchParams } = new URL(req.url);
    const { page, perPage, from, to } = parsePagination(searchParams);

    // 日付範囲（JST 日付）→ UTC 境界。date_from 省略時は当日、date_to 省略時は date_from。
    const dateFrom =
      optionalDateString(searchParams.get("date_from"), "date_from") ??
      todayJst();
    const dateTo =
      optionalDateString(searchParams.get("date_to"), "date_to") ?? dateFrom;
    const startUtc = jstDateStartUtc(dateFrom);
    const endUtc = jstDateEndExclusiveUtc(dateTo);

    const staffId = searchParams.get("staff_id");
    if (staffId) assertUuid(staffId, "staff_id");
    const statusParam = searchParams.get("status");
    const status = statusParam ? assertReservationStatus(statusParam) : null;

    let query = svc
      .from("t_reservation")
      .select(
        "note_id, staff_id, status, reservation_start, reservation_end, main_menu, current_task_id",
        { count: "exact" },
      )
      .eq("salon_id", auth.salonId)
      .gte("reservation_start", startUtc)
      .lt("reservation_start", endUtc);
    if (staffId) query = query.eq("staff_id", staffId);
    if (status) query = query.eq("status", status);

    const {
      data: rows,
      count,
      error,
    } = await query
      .order("reservation_start", { ascending: true })
      .range(from, to);
    if (error) {
      throw new ApiError("INTERNAL_ERROR", "予約一覧の取得に失敗しました。");
    }
    const reservations = rows ?? [];

    // client は予約ノート（t_be_note.client_id）経由。staff 名と並行して引く。
    const noteIds = reservations.map((r) => r.note_id);
    const [clientByNote, staffNames] = await Promise.all([
      fetchClientByNote(svc, noteIds),
      fetchStaffNames(
        svc,
        reservations.map((r) => r.staff_id),
      ),
    ]);

    const data = reservations.map((r) => ({
      note_id: r.note_id,
      client: clientByNote.get(r.note_id) ?? null,
      staff: staffRef(r.staff_id, staffNames),
      status: r.status,
      reservation_start: r.reservation_start,
      reservation_end: r.reservation_end,
      main_menu: r.main_menu,
      current_task_id: r.current_task_id,
    }));

    return paginated(data, { page, per_page: perPage, total: count ?? 0 });
  },
  { roles: ["staff", "admin"] },
);

type ClientRef = { client_id: string; client_name: string | null };

/** note_id → { client_id, client_name }（予約ノート→顧客）。 */
async function fetchClientByNote(
  svc: SupabaseClient,
  noteIds: string[],
): Promise<Map<string, ClientRef>> {
  const result = new Map<string, ClientRef>();
  if (noteIds.length === 0) return result;

  const { data: notes, error: noteError } = await svc
    .from("t_be_note")
    .select("note_id, client_id")
    .in("note_id", noteIds);
  if (noteError) {
    throw new ApiError("INTERNAL_ERROR", "予約ノートの取得に失敗しました。");
  }
  const noteRows = notes ?? [];
  const clientIds = [...new Set(noteRows.map((n) => n.client_id))];
  if (clientIds.length === 0) return result;

  const { data: clients, error: clientError } = await svc
    .from("t_client")
    .select("client_id, client_name")
    .in("client_id", clientIds);
  if (clientError) {
    throw new ApiError("INTERNAL_ERROR", "顧客情報の取得に失敗しました。");
  }
  const nameById = new Map(
    (clients ?? []).map((c) => [c.client_id, c.client_name]),
  );

  for (const n of noteRows) {
    result.set(n.note_id, {
      client_id: n.client_id,
      client_name: nameById.get(n.client_id) ?? null,
    });
  }
  return result;
}
