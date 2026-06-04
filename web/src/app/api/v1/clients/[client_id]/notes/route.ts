import type { SupabaseClient } from "@supabase/supabase-js";
import { apiRoute } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { assertUuid } from "@/lib/api/validate";
import { assertClientAccess } from "@/lib/api/ownership";
import { toNoteTypeCode, toNoteTypeId } from "@/lib/api/note-type";
import { fetchStaffNames, staffRef } from "@/lib/api/staff";

type Params = { client_id: string };

/**
 * GET /api/v1/clients/{client_id}/notes — Be:note 一覧（staff / admin / customer 自分のみ）。
 * 来店ごとの head ノードをページングで返し、各 head の直下 children を付与する。
 * Be:note は head を親とする木構造。
 */
export const GET = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    assertUuid(params.client_id, "client_id");
    assertClientAccess(auth, params.client_id);

    const { searchParams } = new URL(req.url);
    const { page, perPage, from, to } = parsePagination(searchParams);
    const futureFlg = parseBool(searchParams.get("future_flg"), "future_flg");

    // head ノード（来店単位）をページングで取得。
    let headQuery = svc
      .from("t_be_note")
      .select("note_id, responsible, creation_datetime, future_flg", {
        count: "exact",
      })
      .eq("client_id", params.client_id)
      .eq("note_type", toNoteTypeId("head"))
      .eq("delete_flg", false);
    if (futureFlg !== undefined) headQuery = headQuery.eq("future_flg", futureFlg);

    const {
      data: heads,
      count,
      error,
    } = await headQuery
      .order("creation_datetime", { ascending: false })
      .range(from, to);
    if (error) throw new ApiError("INTERNAL_ERROR", "Be:note の取得に失敗しました。");

    const headRows = heads ?? [];
    const headIds = headRows.map((h) => h.note_id);

    // 主担当スタッフ名をまとめて引く。
    const staffNames = await fetchStaffNames(
      svc,
      headRows.map((h) => h.responsible),
    );

    // 直下 children をまとめて取得し、head ごとにまとめる。
    const childrenByParent = await fetchChildren(svc, headIds);

    const data = headRows.map((h) => ({
      note_id: h.note_id,
      p_note_id: null,
      note_type: "head",
      responsible: staffRef(h.responsible, staffNames),
      creation_datetime: h.creation_datetime,
      future_flg: h.future_flg,
      children: childrenByParent.get(h.note_id) ?? [],
    }));

    return paginated(data, { page, per_page: perPage, total: count ?? 0 });
  },
  { roles: ["staff", "admin", "customer"] },
);

/** head の直下 children を取得し、p_note_id ごとに要約してまとめる。 */
async function fetchChildren(
  svc: SupabaseClient,
  headIds: string[],
): Promise<Map<string, unknown[]>> {
  const map = new Map<string, unknown[]>();
  if (headIds.length === 0) return map;

  const { data: children, error } = await svc
    .from("t_be_note")
    .select("note_id, p_note_id, note_type")
    .in("p_note_id", headIds)
    .eq("delete_flg", false)
    .order("creation_datetime", { ascending: true });
  if (error) throw new ApiError("INTERNAL_ERROR", "子ノードの取得に失敗しました。");
  const childRows = children ?? [];

  // reservation の子要約用に t_reservation をまとめて引く。
  const reservationTypeId = toNoteTypeId("reservation");
  const reservationIds = childRows
    .filter((c) => c.note_type === reservationTypeId)
    .map((c) => c.note_id);
  const reservations = new Map<string, Record<string, unknown>>();
  if (reservationIds.length > 0) {
    const { data: rs, error: rError } = await svc
      .from("t_reservation")
      .select("note_id, reservation_start, reservation_end, main_menu, status, total")
      .in("note_id", reservationIds);
    if (rError) throw new ApiError("INTERNAL_ERROR", "予約情報の取得に失敗しました。");
    for (const r of rs ?? []) reservations.set(r.note_id, r);
  }

  for (const c of childRows) {
    const base: Record<string, unknown> = {
      note_id: c.note_id,
      note_type: toNoteTypeCode(c.note_type),
    };
    if (c.note_type === reservationTypeId) {
      const r = reservations.get(c.note_id);
      if (r) {
        base.reservation_start = r.reservation_start;
        base.reservation_end = r.reservation_end;
        base.main_menu = r.main_menu;
        base.status = r.status;
        base.total = r.total;
      }
    }
    const list = map.get(c.p_note_id) ?? [];
    list.push(base);
    map.set(c.p_note_id, list);
  }
  return map;
}

/** "true"/"false" を真偽に。未指定は undefined。 */
function parseBool(raw: string | null, field: string): boolean | undefined {
  if (raw === null || raw === "") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ApiError("INVALID_PARAMS", `${field} は true / false で指定してください。`);
}
