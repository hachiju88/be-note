import type { SupabaseClient } from "@supabase/supabase-js";
import { apiRoute } from "@/lib/api/handler";
import { ok, paginated } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import {
  assertUuid,
  parseJsonObject,
  requireString,
} from "@/lib/api/validate";
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

// この PR で作成に対応する note_type（reservation は 4.4・予約二重防御で、
// item/discount/photo はリクエスト形が設計書未定義のため後続で対応）。
const CREATABLE_NOTE_TYPES = ["head", "text"] as const;

/**
 * POST /api/v1/clients/{client_id}/notes — Be:note 作成（staff / admin）。
 * 現状は head（新規来店ノード）と text（DM メッセージ）に対応する。
 * Be:note は head を親とする木構造。
 */
export const POST = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    assertUuid(params.client_id, "client_id");
    if (!auth.staffId || !auth.salonId) {
      throw new ApiError("INTERNAL_ERROR", "スタッフ情報が取得できません。");
    }

    const body = await parseJsonObject(req);

    const noteTypeCode = String(body.note_type);
    toNoteTypeId(noteTypeCode); // 既知の note_type か検証（不正なら INVALID_PARAMS）。
    if (!(CREATABLE_NOTE_TYPES as readonly string[]).includes(noteTypeCode)) {
      throw new ApiError(
        "INVALID_PARAMS",
        "作成に対応しているのは note_type=head / text です（reservation 等は今後対応）。",
      );
    }

    const futureFlg = requireOptionalBool(body.future_flg, "future_flg") ?? false;

    // p_note_id。head は親を持てない。head 以外（text 等）は親 head が必須。
    // 親なしで作ると head 起点の GET 一覧に現れない迷子データになるため必須化し、
    // 親が同一顧客の head（note_type=1）であることまで検証する。
    let pNoteId: string | null = null;
    if (noteTypeCode === "head") {
      if (body.p_note_id != null) {
        throw new ApiError("INVALID_PARAMS", "head は p_note_id を指定できません。");
      }
    } else {
      if (body.p_note_id == null) {
        throw new ApiError(
          "INVALID_PARAMS",
          `${noteTypeCode} には p_note_id が必須です。`,
        );
      }
      pNoteId = assertUuid(String(body.p_note_id), "p_note_id");
      const { data: parent, error: parentError } = await svc
        .from("t_be_note")
        .select("note_id, note_type")
        .eq("note_id", pNoteId)
        .eq("client_id", params.client_id)
        .eq("delete_flg", false)
        .maybeSingle();
      if (parentError) {
        throw new ApiError("INTERNAL_ERROR", "親ノートの確認に失敗しました。");
      }
      if (!parent) {
        throw new ApiError("INVALID_PARAMS", "親ノート（p_note_id）が見つかりません。");
      }
      if (parent.note_type !== toNoteTypeId("head")) {
        throw new ApiError(
          "INVALID_PARAMS",
          "親ノート（p_note_id）は head である必要があります。",
        );
      }
    }

    const insert: Record<string, unknown> = {
      p_note_id: pNoteId,
      note_type: toNoteTypeId(noteTypeCode),
      salon_id: auth.salonId,
      client_id: params.client_id,
      responsible: auth.staffId,
      future_flg: futureFlg,
    };
    if (noteTypeCode === "text") {
      insert.is_client = false; // staff/admin 作成の DM（顧客発はモバイル側）。
      insert.text = requireString(body.text, "text", 300);
      insert.read_flg = false; // 受信側（顧客）未読。
    }

    const { data: created, error } = await svc
      .from("t_be_note")
      .insert(insert)
      .select("note_id")
      .single();
    if (error || !created) {
      throw new ApiError("INTERNAL_ERROR", "Be:note の作成に失敗しました。");
    }

    return ok({ note_id: created.note_id }, 201);
  },
  { roles: ["staff", "admin"] },
);

/** JSON 真偽値（未指定は undefined、非 boolean は INVALID_PARAMS）。 */
function requireOptionalBool(
  v: unknown,
  field: string,
): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") {
    throw new ApiError("INVALID_PARAMS", `${field} は true / false で指定してください。`);
  }
  return v;
}

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
