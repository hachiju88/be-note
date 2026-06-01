import { requireStaff } from "@/lib/auth";

/**
 * (app) グループ: staff / admin 向けレイアウト。
 * requireStaff() で staff 以上を強制する（未認証→/login、customer→退避）。
 * ヘッダーは各画面の AppHeader コンポーネントで持つ（画面名・ナビが異なるため）。
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();

  return <div className="flex min-h-screen flex-col bg-gray-50">{children}</div>;
}
