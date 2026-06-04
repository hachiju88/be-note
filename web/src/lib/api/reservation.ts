import { ApiError } from "./errors";

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
