export type StaffRole = "stylist" | "assistant";

export type Staff = {
  id: string;
  name: string;
  role: StaffRole;
};

export const MOCK_STAFF: Staff[] = [
  { id: "s001", name: "田中 太郎", role: "stylist" },
  { id: "s002", name: "鈴木 一郎", role: "stylist" },
  { id: "s003", name: "山本 さくら", role: "assistant" },
];

export const MOCK_STAFF_NAMES = MOCK_STAFF.map((s) => s.name);

export const ROLE_LABEL: Record<StaffRole, string> = {
  stylist: "スタイリスト",
  assistant: "アシスタント",
};
