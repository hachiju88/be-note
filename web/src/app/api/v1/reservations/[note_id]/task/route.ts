import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { assertUuid, parseJsonObject, requireUuid } from "@/lib/api/validate";

type Params = { note_id: string };

/**
 * PATCH /api/v1/reservations/{note_id}/task — タスク進行（予約ボード D&D）。
 * current_task_id を更新する。task_id は同一サロンの t_task に存在する必要がある。
 */
export const PATCH = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    if (!auth.salonId) {
      throw new ApiError("INTERNAL_ERROR", "サロン情報が取得できません。");
    }
    assertUuid(params.note_id, "note_id");
    const body = await parseJsonObject(req);
    const taskId = requireUuid(body.task_id, "task_id");

    // 予約の存在確認（自サロン・論理削除されていない予約か）。
    const { data: reservation, error: findError } = await svc
      .from("t_reservation")
      .select("note_id, t_be_note!inner(delete_flg)")
      .eq("note_id", params.note_id)
      .eq("salon_id", auth.salonId)
      .eq("t_be_note.delete_flg", false)
      .maybeSingle();
    if (findError) throw new ApiError("INTERNAL_ERROR", "予約の取得に失敗しました。");
    if (!reservation) throw new ApiError("NOT_FOUND", "予約が見つかりません。");

    // task_id が同一サロンに存在するか検証。
    const { data: task, error: taskError } = await svc
      .from("t_task")
      .select("task_id")
      .eq("task_id", taskId)
      .eq("salon_id", auth.salonId)
      .maybeSingle();
    if (taskError) throw new ApiError("INTERNAL_ERROR", "タスクの取得に失敗しました。");
    if (!task) {
      throw new ApiError("INVALID_PARAMS", "task_id が存在しません。");
    }

    const { error: updateError } = await svc
      .from("t_reservation")
      .update({ current_task_id: taskId })
      .eq("note_id", params.note_id);
    if (updateError) {
      throw new ApiError("INTERNAL_ERROR", "タスク更新に失敗しました。");
    }

    return ok({ note_id: params.note_id, current_task_id: taskId });
  },
  { roles: ["staff", "admin"] },
);
