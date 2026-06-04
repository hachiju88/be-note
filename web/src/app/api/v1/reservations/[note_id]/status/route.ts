import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { assertUuid, optionalString, parseJsonObject } from "@/lib/api/validate";
import { assertClientAccess } from "@/lib/api/ownership";
import {
  assertReservationStatus,
  canTransition,
  type ReservationStatus,
} from "@/lib/api/reservation";

type Params = { note_id: string };

/**
 * PATCH /api/v1/reservations/{note_id}/status — ステータス更新。
 * staff / admin は state machine に沿った遷移、customer は自分の予約の cancelled のみ。
 * confirmed への遷移は EXCLUDE でダブルブッキング再判定（409）。
 * checked_in/done では actual_start/end を記録、cancelled/rejected は理由を保存。
 */
export const PATCH = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    assertUuid(params.note_id, "note_id");
    const body = await parseJsonObject(req);
    const target = assertReservationStatus(String(body.status));
    const reason = optionalString(body.reason, "reason", 100);

    const { data: r, error } = await svc
      .from("t_reservation")
      .select(
        "note_id, status, salon_id, reservation_start, t_be_note!inner(client_id, delete_flg)",
      )
      .eq("note_id", params.note_id)
      .eq("t_be_note.delete_flg", false)
      .maybeSingle();
    if (error) throw new ApiError("INTERNAL_ERROR", "予約の取得に失敗しました。");
    if (!r) throw new ApiError("NOT_FOUND", "予約が見つかりません。");

    // staff/admin は自サロンの予約のみ操作可（多店舗化時の越境防止）。
    // customer は salon を持たず、後段の assertClientAccess（本人性）で判定する。
    if (auth.role !== "customer" && auth.salonId && r.salon_id !== auth.salonId) {
      throw new ApiError("NOT_FOUND", "予約が見つかりません。");
    }

    const current = r.status as ReservationStatus;
    const embed = Array.isArray(r.t_be_note) ? r.t_be_note[0] : r.t_be_note;
    const clientId = embed?.client_id as string | undefined;

    // 認可: customer は自分の予約のキャンセルのみ。
    if (auth.role === "customer") {
      assertClientAccess(auth, clientId ?? "");
      if (target !== "cancelled") {
        throw new ApiError("FORBIDDEN", "顧客はキャンセルのみ可能です。");
      }
    }

    if (!canTransition(current, target)) {
      throw new ApiError(
        "INVALID_PARAMS",
        `status を ${current} から ${target} へは変更できません。`,
      );
    }

    // キャンセル期限チェック（customer のみ）。staff/admin は期限に関係なく可。
    if (auth.role === "customer" && target === "cancelled") {
      const { data: salon, error: salonError } = await svc
        .from("t_salon")
        .select("cancel_deadline_days")
        .eq("salon_id", r.salon_id)
        .maybeSingle();
      // エラーを無視すると days=0 でキャンセル期限を素通りさせてしまう（要厳格化）。
      if (salonError) {
        throw new ApiError("INTERNAL_ERROR", "サロン情報の取得に失敗しました。");
      }
      const days = salon?.cancel_deadline_days ?? 0;
      const deadline =
        Date.parse(r.reservation_start) - days * 24 * 60 * 60 * 1000;
      if (Date.now() >= deadline) {
        throw new ApiError("FORBIDDEN", "キャンセル期限を過ぎています。");
      }
    }

    const patch: Record<string, unknown> = { status: target };
    const nowIso = new Date().toISOString();
    if (target === "checked_in") patch.actual_start = nowIso;
    if (target === "done") patch.actual_end = nowIso;
    if (target === "cancelled" || target === "rejected") {
      patch.cancel_reason = reason;
    }

    const { error: updateError } = await svc
      .from("t_reservation")
      .update(patch)
      .eq("note_id", params.note_id);
    if (updateError) {
      // confirmed への遷移で枠が重なった場合（EXCLUDE / 23P01）。
      if (updateError.code === "23P01") {
        throw new ApiError(
          "DOUBLE_BOOKING",
          "指定の時間帯はすでに予約が入っています。",
        );
      }
      throw new ApiError("INTERNAL_ERROR", "ステータス更新に失敗しました。");
    }

    return ok({ note_id: params.note_id, status: target });
  },
  { roles: ["staff", "admin", "customer"] },
);
