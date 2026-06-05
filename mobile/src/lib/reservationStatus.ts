export const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  requested: "リクエスト申込中",
  pending: "保留中",
  confirmed: "予約済",
  checked_in: "来店",
  in_progress: "施術中",
  done: "会計済",
  cancelled: "キャンセル",
  rejected: "却下",
};

export const STATUS_COLOR: Record<string, string> = {
  confirmed: "#3b82f6",
  checked_in: "#f59e0b",
  in_progress: "#22c55e",
  done: "#94a3b8",
  cancelled: "#ef4444",
  requested: "#8b5cf6",
  pending: "#f97316",
  draft: "#94a3b8",
  rejected: "#ef4444",
  default: "#94a3b8",
};
