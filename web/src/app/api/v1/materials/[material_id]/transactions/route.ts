import type { SupabaseClient } from "@supabase/supabase-js";
import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import {
  assertUuid,
  optionalDateString,
  optionalString,
  parseJsonObject,
  requireEnum,
  requireNumber,
} from "@/lib/api/validate";
import { jstDateEndExclusiveUtc, jstDateStartUtc } from "@/lib/api/datetime";
import { mapMaterialRpcError } from "@/lib/api/material";

type Params = { material_id: string };

const TRANSACTION_TYPES = ["in", "out", "adjust"] as const;

/** 対象材料が自サロンに存在するか検証する（無ければ 404）。 */
async function assertMaterialInSalon(
  svc: SupabaseClient,
  materialId: string,
  salonId: string | null,
): Promise<void> {
  const { data, error } = await svc
    .from("t_material")
    .select("material_id")
    .eq("material_id", materialId)
    .eq("salon_id", salonId)
    .eq("delete_flg", false)
    .maybeSingle();
  if (error) {
    throw new ApiError("INTERNAL_ERROR", "材料の確認に失敗しました。");
  }
  if (!data) {
    throw new ApiError("NOT_FOUND", "対象の材料が見つかりません。");
  }
}

/**
 * GET /api/v1/materials/{material_id}/transactions — 入出庫履歴（admin）。
 * date_from/date_to（JST 日付）で transaction_datetime を絞り込める。
 */
export const GET = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    const materialId = assertUuid(params.material_id, "material_id");
    await assertMaterialInSalon(svc, materialId, auth.salonId);

    const sp = new URL(req.url).searchParams;
    const dateFrom = optionalDateString(sp.get("date_from"), "date_from");
    const dateTo = optionalDateString(sp.get("date_to"), "date_to");
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new ApiError(
        "INVALID_PARAMS",
        "date_from は date_to 以前の日付で指定してください。",
      );
    }

    let q = svc
      .from("t_material_transaction")
      .select(
        "transaction_id, transaction_type, quantity, transaction_datetime, memo, t_staff(staff_id, staff_name)",
      )
      .eq("material_id", materialId)
      .eq("salon_id", auth.salonId)
      .eq("delete_flg", false)
      .order("transaction_datetime", { ascending: false });
    if (dateFrom) q = q.gte("transaction_datetime", jstDateStartUtc(dateFrom));
    if (dateTo) q = q.lt("transaction_datetime", jstDateEndExclusiveUtc(dateTo));

    const { data, error } = await q;
    if (error) {
      throw new ApiError("INTERNAL_ERROR", "入出庫履歴の取得に失敗しました。");
    }

    const result = (data ?? []).map((r) => {
      const staffEmbed = r.t_staff as
        | { staff_id: string; staff_name: string | null }
        | { staff_id: string; staff_name: string | null }[]
        | null;
      const staff = Array.isArray(staffEmbed) ? (staffEmbed[0] ?? null) : staffEmbed;
      return {
        transaction_id: r.transaction_id,
        transaction_type: r.transaction_type,
        quantity: r.quantity,
        transaction_datetime: r.transaction_datetime,
        staff: staff
          ? { staff_id: staff.staff_id, staff_name: staff.staff_name }
          : null,
        memo: r.memo,
      };
    });
    return ok(result);
  },
  { roles: ["admin"] },
);

/**
 * POST /api/v1/materials/{material_id}/transactions — 入出庫登録（admin）。
 * 台帳追記と current_stock 更新を RPC（record_material_transaction）で原子的に行う。
 */
export const POST = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    const materialId = assertUuid(params.material_id, "material_id");
    if (!auth.staffId) {
      throw new ApiError("INTERNAL_ERROR", "操作スタッフが特定できません。");
    }
    const body = await parseJsonObject(req);
    const transactionType = requireEnum(
      body.transaction_type,
      "transaction_type",
      TRANSACTION_TYPES,
    );
    const quantity = requireNumber(body.quantity, "quantity", 0);
    const memo = optionalString(body.memo, "memo", 100);

    const { data, error } = await svc.rpc("record_material_transaction", {
      payload: {
        material_id: materialId,
        salon_id: auth.salonId,
        staff_id: auth.staffId,
        transaction_type: transactionType,
        quantity,
        memo,
      },
    });
    if (error) mapMaterialRpcError(error);
    const transactionId = (data as { transaction_id?: string } | null)
      ?.transaction_id;
    if (!transactionId) {
      throw new ApiError("INTERNAL_ERROR", "入出庫の登録に失敗しました。");
    }
    return ok({ transaction_id: transactionId }, 201);
  },
  { roles: ["admin"] },
);
