import { ApiError } from "./errors";
import {
  optionalDateString,
  optionalString,
  optionalUuid,
  requireBoolean,
  requireEnum,
  requireInt,
  requireIntInRange,
  requireNumber,
  requireString,
  requireTime,
  requireUuid,
} from "./validate";

/**
 * マスタ保守（/api/v1/masters/{resource}）の resource 定義レジストリ。
 * salon_id を持つマスタを汎用 CRUD で扱う。staff-skills（複合キー・salon_id なし）は
 * ルート側で特別扱いする。
 */
export type MasterDef = {
  table: string;
  listColumns: string;
  /** パス {id} がマップされる列。 */
  idColumn: string;
  idType: "uuid" | "int" | "date";
  /** true=delete_flg による論理削除 / false=物理削除。 */
  logicalDelete: boolean;
  orderBy?: { column: string; ascending?: boolean };
  buildInsert: (b: Record<string, unknown>) => Record<string, unknown>;
  /** 省略時は PUT 非対応。 */
  buildUpdate?: (b: Record<string, unknown>) => Record<string, unknown>;
};

/** body に存在するキーだけ検証して部分更新オブジェクトを作る。 */
function pickDefined(
  b: Record<string, unknown>,
  validators: Record<string, () => unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(validators)) {
    if (key in b) out[key] = fn();
  }
  return out;
}

/** 必須日付（YYYY-MM-DD）。 */
function requireDate(v: unknown, field: string): string {
  const d = optionalDateString(v, field);
  if (!d) throw new ApiError("INVALID_PARAMS", `${field} は必須です（YYYY-MM-DD）。`);
  return d;
}

/** role_limit（NULL もしくは 'stylist'）。 */
function parseRoleLimit(v: unknown): string | null {
  return v == null ? null : requireEnum(v, "role_limit", ["stylist"]);
}

export const MASTERS: Record<string, MasterDef> = {
  menus: {
    table: "t_menu_master",
    listColumns: "menu_master_id, menu_name, kinds, base_price, duration_minutes",
    idColumn: "menu_master_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "menu_name" },
    buildInsert: (b) => ({
      menu_name: requireString(b.menu_name, "menu_name", 20),
      kinds: optionalString(b.kinds, "kinds", 20),
      base_price: requireInt(b.base_price, "base_price", 0),
      duration_minutes: requireInt(b.duration_minutes, "duration_minutes", 1),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        menu_name: () => requireString(b.menu_name, "menu_name", 20),
        kinds: () => optionalString(b.kinds, "kinds", 20),
        base_price: () => requireInt(b.base_price, "base_price", 0),
        duration_minutes: () => requireInt(b.duration_minutes, "duration_minutes", 1),
      }),
  },

  tasks: {
    table: "t_task",
    listColumns: "task_id, task_name, task_order, role_limit",
    idColumn: "task_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "task_order", ascending: true },
    buildInsert: (b) => ({
      task_name: requireString(b.task_name, "task_name", 20),
      task_order: requireInt(b.task_order, "task_order"),
      role_limit: parseRoleLimit(b.role_limit),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        task_name: () => requireString(b.task_name, "task_name", 20),
        task_order: () => requireInt(b.task_order, "task_order"),
        role_limit: () => parseRoleLimit(b.role_limit),
      }),
  },

  staff: {
    table: "t_staff",
    listColumns:
      "staff_id, staff_name, staff_kana, position, is_admin, nomination_fee",
    idColumn: "staff_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "staff_name" },
    buildInsert: (b) => ({
      staff_name: requireString(b.staff_name, "staff_name", 20),
      staff_kana: optionalString(b.staff_kana, "staff_kana", 20),
      position: requireEnum(b.position, "position", ["stylist", "assistant"]),
      is_admin: b.is_admin === undefined ? false : requireBoolean(b.is_admin, "is_admin"),
      nomination_fee:
        b.nomination_fee === undefined
          ? 0
          : requireInt(b.nomination_fee, "nomination_fee", 0),
      user_id: optionalUuid(b.user_id, "user_id"),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        staff_name: () => requireString(b.staff_name, "staff_name", 20),
        staff_kana: () => optionalString(b.staff_kana, "staff_kana", 20),
        position: () => requireEnum(b.position, "position", ["stylist", "assistant"]),
        is_admin: () => requireBoolean(b.is_admin, "is_admin"),
        nomination_fee: () => requireInt(b.nomination_fee, "nomination_fee", 0),
        user_id: () => optionalUuid(b.user_id, "user_id"),
      }),
  },

  slots: {
    table: "t_reservation_slot",
    listColumns: "slot_id, slot_name",
    idColumn: "slot_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "slot_name" },
    buildInsert: (b) => ({ slot_name: requireString(b.slot_name, "slot_name", 30) }),
    buildUpdate: (b) =>
      pickDefined(b, {
        slot_name: () => requireString(b.slot_name, "slot_name", 30),
      }),
  },

  shifts: {
    table: "t_shift",
    listColumns: "shift_id, staff_id, shift_date, start_time, end_time",
    idColumn: "shift_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "shift_date" },
    buildInsert: (b) => ({
      staff_id: requireUuid(b.staff_id, "staff_id"),
      shift_date: requireDate(b.shift_date, "shift_date"),
      start_time: requireTime(b.start_time, "start_time"),
      end_time: requireTime(b.end_time, "end_time"),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        staff_id: () => requireUuid(b.staff_id, "staff_id"),
        shift_date: () => requireDate(b.shift_date, "shift_date"),
        start_time: () => requireTime(b.start_time, "start_time"),
        end_time: () => requireTime(b.end_time, "end_time"),
      }),
  },

  materials: {
    table: "t_material",
    listColumns:
      "material_id, material_name, unit, current_stock, reorder_point",
    idColumn: "material_id",
    idType: "uuid",
    logicalDelete: true,
    orderBy: { column: "material_name" },
    buildInsert: (b) => ({
      material_name: requireString(b.material_name, "material_name", 50),
      unit: requireString(b.unit, "unit", 10),
      reorder_point:
        b.reorder_point === undefined
          ? 0
          : requireNumber(b.reorder_point, "reorder_point", 0),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        material_name: () => requireString(b.material_name, "material_name", 50),
        unit: () => requireString(b.unit, "unit", 10),
        reorder_point: () => requireNumber(b.reorder_point, "reorder_point", 0),
      }),
  },

  "business-hours": {
    table: "t_business_hour",
    listColumns: "day_of_week, open_time, close_time",
    idColumn: "day_of_week",
    idType: "int",
    logicalDelete: false, // 設定テーブル＝物理削除
    orderBy: { column: "day_of_week", ascending: true },
    buildInsert: (b) => ({
      day_of_week: requireIntInRange(b.day_of_week, "day_of_week", 0, 6),
      open_time: requireTime(b.open_time, "open_time"),
      close_time: requireTime(b.close_time, "close_time"),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        open_time: () => requireTime(b.open_time, "open_time"),
        close_time: () => requireTime(b.close_time, "close_time"),
      }),
  },

  holidays: {
    table: "t_holiday",
    listColumns: "holiday_date, reason",
    idColumn: "holiday_date",
    idType: "date",
    logicalDelete: false, // 設定テーブル＝物理削除
    orderBy: { column: "holiday_date", ascending: true },
    buildInsert: (b) => ({
      holiday_date: requireDate(b.holiday_date, "holiday_date"),
      reason: optionalString(b.reason, "reason", 50),
    }),
    buildUpdate: (b) =>
      pickDefined(b, {
        reason: () => optionalString(b.reason, "reason", 50),
      }),
  },
};

/** resource 名から定義を引く。未知なら 404。 */
export function getMasterDef(resource: string): MasterDef {
  const def = MASTERS[resource];
  if (!def) throw new ApiError("NOT_FOUND", `未知のマスタ resource: ${resource}`);
  return def;
}

/** パス {id} を idType に応じて解釈・検証する。 */
export function parseMasterId(def: MasterDef, raw: string): string | number {
  if (def.idType === "uuid") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      throw new ApiError("INVALID_PARAMS", `${def.idColumn} の形式が不正です。`);
    }
    return raw;
  }
  if (def.idType === "int") {
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      throw new ApiError("INVALID_PARAMS", `${def.idColumn} は整数で指定してください。`);
    }
    return n;
  }
  // date（実在日チェック込み）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ApiError("INVALID_PARAMS", `${def.idColumn} は YYYY-MM-DD で指定してください。`);
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new ApiError("INVALID_PARAMS", `${def.idColumn} に有効な日付を指定してください。`);
  }
  return raw;
}

/** マスタ系 DB エラーを共通エラーへマップ。 */
export function mapMasterError(error: { code?: string | null; message?: string | null }): never {
  switch (error.code) {
    case "23503": // foreign_key_violation
    case "23514": // check_violation
      throw new ApiError("INVALID_PARAMS", "入力値が不正です（参照先または制約違反）。");
    case "23505": // unique_violation
      throw new ApiError("INVALID_PARAMS", "既に存在します。");
    default:
      throw new ApiError("INTERNAL_ERROR", "マスタ操作に失敗しました。");
  }
}
