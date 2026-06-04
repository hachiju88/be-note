import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import {
  assertUuid,
  parseJsonObject,
  requireInt,
  requireIsoDatetime,
  requireString,
  requireUuid,
} from "@/lib/api/validate";
import {
  mapReservationRpcError,
  parseMenuList,
} from "@/lib/api/reservation";

type Params = { note_id: string };

/**
 * PUT /api/v1/reservations/{note_id} — 予約内容編集（staff / admin）。
 * version_no 楽観ロック（不一致は 409 VERSION_CONFLICT）、明細は全置換、
 * confirmed 系は EXCLUDE でダブルブッキング再判定（409 DOUBLE_BOOKING）。
 * 原子性のため update_reservation RPC（1 トランザクション）で処理する。
 */
export const PUT = apiRoute<Params>(
  async ({ req, svc, params }) => {
    assertUuid(params.note_id, "note_id");
    const body = await parseJsonObject(req);

    const start = requireIsoDatetime(body.reservation_start, "reservation_start");
    const end = requireIsoDatetime(body.reservation_end, "reservation_end");
    if (Date.parse(start) >= Date.parse(end)) {
      throw new ApiError(
        "INVALID_PARAMS",
        "reservation_start は reservation_end より前にしてください。",
      );
    }

    const payload = {
      note_id: params.note_id,
      staff_id: requireUuid(body.staff_id, "staff_id"),
      reservation_start: start,
      reservation_end: end,
      main_menu: requireString(body.main_menu, "main_menu", 20),
      version_no: requireInt(body.version_no, "version_no", 1),
      menu_list: parseMenuList(body.menu_list),
    };

    const { data, error } = await svc.rpc("update_reservation", { payload });
    if (error) mapReservationRpcError(error);
    const version = (data as { version_no?: number } | null)?.version_no ?? null;
    return ok({ note_id: params.note_id, version_no: version });
  },
  { roles: ["staff", "admin"] },
);
