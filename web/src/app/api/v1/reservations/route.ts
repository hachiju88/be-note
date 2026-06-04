import { apiRoute } from "@/lib/api/handler";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, paginated } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import {
  assertUuid,
  optionalDateString,
  optionalString,
  optionalUuid,
  parseJsonObject,
  requireInt,
  requireIsoDatetime,
  requireString,
  requireUuid,
} from "@/lib/api/validate";
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
 *
 * 論理削除は親 t_be_note.delete_flg で表す（t_reservation 自体は持たない）。
 * よって t_be_note を inner join し delete_flg=false の予約のみ返す（count も正しくなる）。
 * client_id は同じ埋め込みから取得する。
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
    if (dateFrom > dateTo) {
      throw new ApiError(
        "INVALID_PARAMS",
        "date_from は date_to 以前の日付で指定してください。",
      );
    }
    const startUtc = jstDateStartUtc(dateFrom);
    const endUtc = jstDateEndExclusiveUtc(dateTo);

    const staffId = searchParams.get("staff_id");
    if (staffId) assertUuid(staffId, "staff_id");
    const statusParam = searchParams.get("status");
    const status = statusParam ? assertReservationStatus(statusParam) : null;

    let query = svc
      .from("t_reservation")
      .select(
        "note_id, staff_id, status, reservation_start, reservation_end, main_menu, current_task_id, t_be_note!inner(client_id, delete_flg)",
        { count: "exact" },
      )
      .eq("salon_id", auth.salonId)
      .eq("t_be_note.delete_flg", false)
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

    // client_id は埋め込み（t_be_note）から。client 名・staff 名をまとめて引く（N+1 回避）。
    const clientIds = reservations
      .map((r) => embeddedClientId(r.t_be_note))
      .filter((id): id is string => !!id);
    const [clientNames, staffNames] = await Promise.all([
      fetchClientNames(svc, clientIds),
      fetchStaffNames(
        svc,
        reservations.map((r) => r.staff_id),
      ),
    ]);

    const data = reservations.map((r) => {
      const clientId = embeddedClientId(r.t_be_note);
      return {
        note_id: r.note_id,
        client: clientId
          ? {
              client_id: clientId,
              client_name: clientNames.get(clientId) ?? null,
            }
          : null,
        staff: staffRef(r.staff_id, staffNames),
        status: r.status,
        reservation_start: r.reservation_start,
        reservation_end: r.reservation_end,
        main_menu: r.main_menu,
        current_task_id: r.current_task_id,
      };
    });

    return paginated(data, { page, per_page: perPage, total: count ?? 0 });
  },
  { roles: ["staff", "admin"] },
);

/**
 * POST /api/v1/reservations — 即時予約作成（staff / admin）。
 * head＋予約ノード＋t_reservation＋t_menu を RPC で 1 トランザクション作成。
 * 二重防御: Idempotency-Key（冪等）＋ DB EXCLUDE（ダブルブッキング→409）。
 */
export const POST = apiRoute(
  async ({ req, auth, svc }) => {
    if (!auth.salonId) {
      throw new ApiError("INTERNAL_ERROR", "サロン情報が取得できません。");
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new ApiError("INVALID_PARAMS", "Idempotency-Key ヘッダが必要です。");
    }
    assertUuid(idempotencyKey, "Idempotency-Key");

    const body = await parseJsonObject(req);
    const clientId = requireUuid(body.client_id, "client_id");
    const staffId = requireUuid(body.staff_id, "staff_id");
    const slotId = optionalUuid(body.slot_id, "slot_id");
    const start = requireIsoDatetime(body.reservation_start, "reservation_start");
    const end = requireIsoDatetime(body.reservation_end, "reservation_end");
    if (Date.parse(start) >= Date.parse(end)) {
      throw new ApiError(
        "INVALID_PARAMS",
        "reservation_start は reservation_end より前にしてください。",
      );
    }
    const mainMenu = requireString(body.main_menu, "main_menu", 20);
    const menuList = parseMenuList(body.menu_list);
    const futureFlg = Date.parse(start) > Date.now();

    const payload = {
      salon_id: auth.salonId,
      staff_id: staffId,
      client_id: clientId,
      slot_id: slotId,
      reservation_start: start,
      reservation_end: end,
      main_menu: mainMenu,
      future_flg: futureFlg,
      idempotency_key: idempotencyKey,
      menu_list: menuList,
    };

    const { data, error } = await svc.rpc("create_immediate_reservation", {
      payload,
    });
    if (error) {
      if ((error.message ?? "").includes("DOUBLE_BOOKING")) {
        throw new ApiError(
          "DOUBLE_BOOKING",
          "指定の時間帯はすでに予約が入っています。",
        );
      }
      throw new ApiError("INTERNAL_ERROR", "予約の作成に失敗しました。");
    }
    const noteId = (data as { note_id?: string } | null)?.note_id;
    if (!noteId) {
      throw new ApiError("INTERNAL_ERROR", "予約の作成に失敗しました。");
    }
    return ok({ note_id: noteId }, 201);
  },
  { roles: ["staff", "admin"] },
);

/** menu_list（任意配列）を検証して RPC 用に整形する。 */
function parseMenuList(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    throw new ApiError("INVALID_PARAMS", "menu_list は配列で指定してください。");
  }
  return v.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ApiError(
        "INVALID_PARAMS",
        `menu_list[${i}] はオブジェクトで指定してください。`,
      );
    }
    const m = raw as Record<string, unknown>;
    return {
      menu_master_id: optionalUuid(m.menu_master_id, `menu_list[${i}].menu_master_id`),
      menu_name: requireString(m.menu_name, `menu_list[${i}].menu_name`, 20),
      kinds: optionalString(m.kinds, `menu_list[${i}].kinds`, 20),
      staff_id: optionalUuid(m.staff_id, `menu_list[${i}].staff_id`),
      memo: optionalString(m.memo, `menu_list[${i}].memo`, 100),
      price: requireInt(m.price, `menu_list[${i}].price`, 0),
    };
  });
}

/** 埋め込み t_be_note（多対一＝オブジェクト想定）から client_id を取り出す。 */
function embeddedClientId(embedded: unknown): string | null {
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  if (row && typeof row === "object" && "client_id" in row) {
    const id = (row as { client_id: unknown }).client_id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** client_id → client_name のマップ。 */
async function fetchClientNames(
  svc: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(clientIds)];
  if (unique.length === 0) return new Map();
  const { data, error } = await svc
    .from("t_client")
    .select("client_id, client_name")
    .in("client_id", unique);
  if (error) {
    throw new ApiError("INTERNAL_ERROR", "顧客情報の取得に失敗しました。");
  }
  return new Map((data ?? []).map((c) => [c.client_id, c.client_name]));
}
