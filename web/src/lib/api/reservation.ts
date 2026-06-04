import { ApiError } from "./errors";
import {
  optionalString,
  optionalUuid,
  requireInt,
  requireString,
} from "./validate";

/** menu_list（任意配列）を検証して RPC 用に整形する（t_menu のカラム制約に合わせる）。 */
export function parseMenuList(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    throw new ApiError("INVALID_PARAMS", "menu_list は配列で指定してください。");
  }
  return v.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ApiError(
        "INVALID_PARAMS",
        `menu_list[${i}] はオブジェクトで指定してください。`,
      );
    }
    const m = raw as Record<string, unknown>;
    return {
      menu_master_id: optionalUuid(m.menu_master_id, `menu_list[${i}].menu_master_id`),
      menu_name: requireString(m.menu_name, `menu_list[${i}].menu_name`, 20),
      kinds: optionalString(m.kinds, `menu_list[${i}].kinds`, 20),
      staff_id: optionalUuid(m.staff_id, `menu_list[${i}].staff_id`),
      memo: optionalString(m.memo, `menu_list[${i}].memo`, 100),
      price: requireInt(m.price, `menu_list[${i}].price`, 0),
    };
  });
}

/** 予約ステータスの語彙（t_reservation.check_reservation_status と一致）。 */
export const RESERVATION_STATUSES = [
  "draft",
  "requested",
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "done",
  "rejected",
  "cancelled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** status クエリ/入力を検証する。不正なら INVALID_PARAMS。 */
export function assertReservationStatus(v: string): ReservationStatus {
  if (!(RESERVATION_STATUSES as readonly string[]).includes(v)) {
    throw new ApiError(
      "INVALID_PARAMS",
      `status は ${RESERVATION_STATUSES.join(" / ")} のいずれかで指定してください。`,
    );
  }
  return v as ReservationStatus;
}

/**
 * 状態遷移表（docs/予約ロジック設計書.md「予約の状態遷移」）。
 * from → 許可される to の集合。done/rejected/cancelled は終端。
 */
const STATUS_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> =
  {
    draft: ["confirmed", "cancelled"],
    requested: ["pending", "rejected", "cancelled"],
    pending: ["confirmed", "rejected", "cancelled"],
    confirmed: ["checked_in", "cancelled"],
    checked_in: ["in_progress", "cancelled"],
    in_progress: ["done", "cancelled"],
    done: [],
    rejected: [],
    cancelled: [],
  };

/** from→to の遷移が許可されているか。 */
export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/**
 * 予約系 RPC が送出するエラー（P0001＋メッセージ）を共通エラーへマップする。
 * いずれにも該当しなければ INTERNAL_ERROR。
 */
export function mapReservationRpcError(error: {
  code?: string | null;
  message?: string | null;
}): never {
  const m = error.message ?? "";
  if (m.includes("DOUBLE_BOOKING")) {
    throw new ApiError("DOUBLE_BOOKING", "指定の時間帯はすでに予約が入っています。");
  }
  if (m.includes("VERSION_CONFLICT")) {
    throw new ApiError(
      "VERSION_CONFLICT",
      "他の操作が先に更新しました。最新を取得し直してください。",
    );
  }
  if (m.includes("INVALID_REFERENCE")) {
    throw new ApiError(
      "INVALID_PARAMS",
      "参照先（client_id / staff_id / menu_master_id / slot_id）が存在しません。",
    );
  }
  if (m.includes("NOT_FOUND")) {
    throw new ApiError("NOT_FOUND", "対象の予約が見つかりません。");
  }
  throw new ApiError("INTERNAL_ERROR", "予約処理に失敗しました。");
}
