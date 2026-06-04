import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parseJsonObject } from "@/lib/api/validate";
import { getMasterDef, mapMasterError, parseMasterId } from "@/lib/api/masters";

type Params = { resource: string; id: string };

/**
 * PUT /api/v1/masters/{resource}/{id} — マスタ更新（admin）。送信フィールドのみ。
 */
export const PUT = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    const def = getMasterDef(params.resource);
    if (!def.buildUpdate) {
      throw new ApiError("INVALID_PARAMS", "このリソースは更新に対応していません。");
    }
    const id = parseMasterId(def, params.id);
    const body = await parseJsonObject(req);
    const patch = def.buildUpdate(body);

    if (Object.keys(patch).length === 0) {
      return ok({ [def.idColumn]: id });
    }
    const { data, error } = await svc
      .from(def.table)
      .update(patch)
      .eq(def.idColumn, id)
      .eq("salon_id", auth.salonId)
      .select(def.idColumn);
    if (error) mapMasterError(error);
    if (!data || data.length === 0) {
      throw new ApiError("NOT_FOUND", "対象が見つかりません。");
    }
    return ok({ [def.idColumn]: id });
  },
  { roles: ["admin"] },
);

/**
 * DELETE /api/v1/masters/{resource}/{id} — マスタ削除（admin）。
 * delete_flg を持つマスタは論理削除、設定テーブルは物理削除。
 */
export const DELETE = apiRoute<Params>(
  async ({ auth, svc, params }) => {
    const def = getMasterDef(params.resource);
    const id = parseMasterId(def, params.id);

    const base = svc.from(def.table);
    const query = def.logicalDelete
      ? base.update({ delete_flg: true })
      : base.delete();
    const { data, error } = await query
      .eq(def.idColumn, id)
      .eq("salon_id", auth.salonId)
      .select(def.idColumn);
    if (error) mapMasterError(error); // 物理削除時の FK 違反等 → 400
    if (!data || data.length === 0) {
      throw new ApiError("NOT_FOUND", "対象が見つかりません。");
    }
    return ok({ [def.idColumn]: id });
  },
  { roles: ["admin"] },
);
