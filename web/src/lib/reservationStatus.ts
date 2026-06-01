export type ReservationStatus =
  | "draft"
  | "requested"
  | "pending"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "done"
  | "cancelled"
  | "rejected";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  draft: "下書き",
  requested: "リクエスト",
  pending: "保留中",
  confirmed: "予約済",
  checked_in: "来店",
  in_progress: "施術中",
  done: "会計済",
  cancelled: "キャンセル",
  rejected: "却下",
};

export const STATUS_CLASS: Record<ReservationStatus, string> = {
  draft: "bg-gray-50 text-gray-400 border-gray-200",
  requested: "bg-purple-50 text-purple-700 border-purple-200",
  pending: "bg-orange-50 text-orange-700 border-orange-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  checked_in: "bg-yellow-50 text-yellow-700 border-yellow-200",
  in_progress: "bg-green-50 text-green-700 border-green-200",
  done: "bg-gray-50 text-gray-500 border-gray-200",
  cancelled: "bg-red-50 text-red-400 border-red-200",
  rejected: "bg-red-50 text-red-400 border-red-200",
};
