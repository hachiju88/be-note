import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { assertUuid, parseJsonObject, requireUuid } from "@/lib/api/validate";
import { getMasterDef, mapMasterError } from "@/lib/api/masters";

type Params = { resource: string };

/**
 * GET /api/v1/masters/{resource} — マスタ一覧（staff / admin）。
 * staff-skills は salon_id を持たない複合キーのため特別扱い。
 */
export const GET = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    if (params.resource === "staff-skills") {
      const sid = new URL(req.url).searchParams.get("staff_id");
      let q = svc.from("t_staff_skill").select("staff_id, task_id");
      if (sid) q = q.eq("staff_id", assertUuid(sid, "staff_id"));
      const { data, error } = await q;
      if (error) throw new ApiError("INTERNAL_ERROR", "スキルの取得に失敗しました。");
      return ok(data ?? []);
    }

    const def = getMasterDef(params.resource);
    let q = svc.from(def.table).select(def.listColumns).eq("salon_id", auth.salonId);
    if (def.logicalDelete) q = q.eq("delete_flg", false);
    if (def.orderBy) {
      q = q.order(def.orderBy.column, { ascending: def.orderBy.ascending ?? true });
    }
    const { data, error } = await q;
    if (error) throw new ApiError("INTERNAL_ERROR", "マスタの取得に失敗しました。");
    return ok(data ?? []);
  },
  { roles: ["staff", "admin"] },
);

/**
 * POST /api/v1/masters/{resource} — マスタ登録（admin）。
 * staff-skills は { staff_id, task_id } を付与。
 */
export const POST = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    const body = await parseJsonObject(req);

    if (params.resource === "staff-skills") {
      const row = {
        staff_id: requireUuid(body.staff_id, "staff_id"),
        task_id: requireUuid(body.task_id, "task_id"),
      };
      const { error } = await svc.from("t_staff_skill").insert(row);
      if (error) mapMasterError(error);
      return ok(row, 201);
    }

    const def = getMasterDef(params.resource);
    const row = { ...def.buildInsert(body), salon_id: auth.salonId };
    const { data, error } = await svc
      .from(def.table)
      .insert(row)
      .select(def.idColumn)
      .single();
    if (error || !data) mapMasterError(error ?? { message: "insert failed" });
    const created = data as unknown as Record<string, unknown>;
    return ok({ [def.idColumn]: created[def.idColumn] }, 201);
  },
  { roles: ["admin"] },
);

/**
 * DELETE /api/v1/masters/staff-skills?staff_id=&task_id= — スキル剥奪（admin・物理削除）。
 * staff-skills 以外のコレクション DELETE は非対応（/{id} を使用）。
 */
export const DELETE = apiRoute<Params>(
  async ({ req, svc, params }) => {
    if (params.resource !== "staff-skills") {
      throw new ApiError("INVALID_PARAMS", "このリソースは /{id} で削除してください。");
    }
    const sp = new URL(req.url).searchParams;
    const staffId = requireUuid(sp.get("staff_id"), "staff_id");
    const taskId = requireUuid(sp.get("task_id"), "task_id");
    const { error } = await svc
      .from("t_staff_skill")
      .delete()
      .eq("staff_id", staffId)
      .eq("task_id", taskId);
    if (error) throw new ApiError("INTERNAL_ERROR", "スキルの削除に失敗しました。");
    return ok({ staff_id: staffId, task_id: taskId });
  },
  { roles: ["admin"] },
);
