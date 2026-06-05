import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { parseJsonObject } from "@/lib/api/validate";
import { MASTERS, mapMasterError } from "@/lib/api/masters";

const DEF = MASTERS.materials; // 材料マスタの列定義・登録バリデーションを共用。

type MaterialRow = {
  material_id: string;
  material_name: string;
  unit: string;
  current_stock: number;
  reorder_point: number;
};

/**
 * GET /api/v1/materials — 材料一覧（在庫・admin）。
 * low_stock（current_stock <= reorder_point）をサーバ算出して返す。
 * low_stock_only=true で発注点割れのみに絞る。
 */
export const GET = apiRoute(
  async ({ req, auth, svc }) => {
    const lowStockOnly =
      new URL(req.url).searchParams.get("low_stock_only") === "true";

    const { data, error } = await svc
      .from(DEF.table)
      .select(DEF.listColumns)
      .eq("salon_id", auth.salonId)
      .eq("delete_flg", false)
      .order("material_name", { ascending: true });
    if (error) {
      throw new ApiError("INTERNAL_ERROR", "材料一覧の取得に失敗しました。");
    }

    const rows = (data ?? []) as unknown as MaterialRow[];
    const result = rows
      .map((m) => ({ ...m, low_stock: m.current_stock <= m.reorder_point }))
      .filter((m) => !lowStockOnly || m.low_stock);
    return ok(result);
  },
  { roles: ["admin"] },
);

/**
 * POST /api/v1/materials — 材料マスタ登録（admin）。
 * 入力検証・列は MASTERS.materials を共用する（/masters/materials と一貫）。
 */
export const POST = apiRoute(
  async ({ req, auth, svc }) => {
    const body = await parseJsonObject(req);
    const row = { ...DEF.buildInsert(body), salon_id: auth.salonId };
    const { data, error } = await svc
      .from(DEF.table)
      .insert(row)
      .select(DEF.idColumn)
      .single();
    if (error || !data) mapMasterError(error ?? { message: "insert failed" });
    const created = data as unknown as Record<string, unknown>;
    return ok({ [DEF.idColumn]: created[DEF.idColumn] }, 201);
  },
  { roles: ["admin"] },
);
