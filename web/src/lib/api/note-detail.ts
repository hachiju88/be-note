import { ApiError } from "./errors";
import {
  optionalString,
  optionalUuid,
  requireInt,
  requireString,
} from "./validate";

/**
 * 明細を持つ note_type（item / discount / photo）。
 * これらは t_be_note ノード＋明細（t_sold_item / t_discount / t_photo）を
 * RPC create_note_with_details で原子的に作成する。
 */
export type DetailNoteType = "item" | "discount" | "photo";

export function isDetailNoteType(code: string): code is DetailNoteType {
  return code === "item" || code === "discount" || code === "photo";
}

const LIST_KEY: Record<DetailNoteType, string> = {
  item: "item_list",
  discount: "discount_list",
  photo: "photo_list",
};

export type ParsedDetails = {
  /** RPC へ渡す明細（staff_id は解決済み）。 */
  details: Record<string, unknown>[];
  /** 明細で明示指定された staff_id（サロン所属検証用・重複排除済み）。 */
  staffIds: string[];
};

/**
 * note_type に応じた *_list を検証し、RPC 用の明細配列に整形する。
 * staff_id は省略時に defaultStaffId（ノードの主担当）へ解決する。
 * 明示指定された staff_id は staffIds に集約し、呼び出し側でサロン所属を検証する。
 */
export function parseNoteDetails(
  code: DetailNoteType,
  body: Record<string, unknown>,
  defaultStaffId: string,
): ParsedDetails {
  const key = LIST_KEY[code];
  const raw = body[key];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${key} は1件以上の配列で指定してください。`,
    );
  }

  const details: Record<string, unknown>[] = [];
  const staffIds = new Set<string>();

  raw.forEach((entry, idx) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ApiError(
        "INVALID_PARAMS",
        `${key}[${idx}] はオブジェクトで指定してください。`,
      );
    }
    const e = entry as Record<string, unknown>;
    const prefix = `${key}[${idx}]`;

    const explicitStaff = optionalUuid(e.staff_id, `${prefix}.staff_id`);
    if (explicitStaff) staffIds.add(explicitStaff);
    const staffId = explicitStaff ?? defaultStaffId;

    if (code === "item") {
      details.push({
        staff_id: staffId,
        item_name: requireString(e.item_name, `${prefix}.item_name`, 20),
        kinds: optionalString(e.kinds, `${prefix}.kinds`, 20),
        memo: optionalString(e.memo, `${prefix}.memo`, 100),
        price: requireInt(e.price, `${prefix}.price`),
      });
    } else if (code === "discount") {
      const price = requireInt(e.price, `${prefix}.price`);
      if (price > 0) {
        // t_discount.check_discount_price（price <= 0）に対応。
        throw new ApiError(
          "INVALID_PARAMS",
          `${prefix}.price は0以下（割引額）で指定してください。`,
        );
      }
      details.push({
        staff_id: staffId,
        discount_name: requireString(
          e.discount_name,
          `${prefix}.discount_name`,
          20,
        ),
        kinds: optionalString(e.kinds, `${prefix}.kinds`, 20),
        memo: optionalString(e.memo, `${prefix}.memo`, 100),
        price,
      });
    } else {
      // photo
      details.push({
        staff_id: staffId,
        storage_path: requireString(
          e.storage_path,
          `${prefix}.storage_path`,
          200,
        ),
        memo: optionalString(e.memo, `${prefix}.memo`, 100),
      });
    }
  });

  return { details, staffIds: [...staffIds] };
}

/** create_note_with_details RPC のエラーを共通エラーへマップする。 */
export function mapNoteDetailError(error: {
  code?: string | null;
  message?: string | null;
}): never {
  // FK 違反（p_note_id / staff_id）・チェック制約（割引額）。アプリ層で
  // 事前検証済みのため通常は到達しないが、防御的に 400 へマップする。
  if (error.code === "23503" || error.code === "23514") {
    throw new ApiError("INVALID_PARAMS", "入力値が不正です（参照先または制約違反）。");
  }
  if (error.code === "P0001") {
    throw new ApiError("INVALID_PARAMS", "明細の作成に失敗しました（入力値をご確認ください）。");
  }
  throw new ApiError("INTERNAL_ERROR", "Be:note の作成に失敗しました。");
}
