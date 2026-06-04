import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import {
  assertUuid,
  optionalUuid,
  parseJsonObject,
  requireIsoDatetime,
  requireUuid,
} from "@/lib/api/validate";
import { mapReservationRpcError } from "@/lib/api/reservation";

/**
 * POST /api/v1/reservation-requests — リクエスト予約申込（customer）。
 * 自分（auth.clientId）名義で status=requested を作成する。所要時間は
 * menu_master.duration_minutes から RPC 内で算出。create_reservation_request で原子的処理。
 *
 * staff_id は任意（指名なし可）。指名なしは t_reservation.staff_id / t_be_note.responsible
 * が NULL となり、承認（confirmed）時にスタッフを割り当てる（status は staff 未割当だと
 * confirmed へ遷移不可）。
 */
export const POST = apiRoute(
  async ({ req, auth, svc }) => {
    if (!auth.clientId) {
      throw new ApiError("FORBIDDEN", "顧客アカウントが必要です。");
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new ApiError("INVALID_PARAMS", "Idempotency-Key ヘッダが必要です。");
    }
    assertUuid(idempotencyKey, "Idempotency-Key");

    const body = await parseJsonObject(req);
    const payload = {
      client_id: auth.clientId,
      staff_id: optionalUuid(body.staff_id, "staff_id"),
      menu_master_id: requireUuid(body.menu_master_id, "menu_master_id"),
      desired_start: requireIsoDatetime(body.desired_start, "desired_start"),
      idempotency_key: idempotencyKey,
    };

    const { data, error } = await svc.rpc("create_reservation_request", {
      payload,
    });
    if (error) mapReservationRpcError(error);
    const result = data as { note_id?: string; status?: string } | null;
    if (!result?.note_id) {
      throw new ApiError("INTERNAL_ERROR", "リクエスト予約の作成に失敗しました。");
    }
    return ok({ note_id: result.note_id, status: result.status ?? "requested" }, 201);
  },
  { roles: ["customer"] },
);
