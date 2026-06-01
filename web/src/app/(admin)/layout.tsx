import { requireAdmin } from "@/lib/auth";

/**
 * (admin) グループ: admin 専用レイアウト。
 * requireAdmin() で admin（t_staff.is_admin = true）を強制する。
 * admin 以外は /menu へ退避する。
 * ヘッダーは各画面の AppHeader コンポーネントで持つ（画面名・ナビが異なるため）。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <div className="flex min-h-screen flex-col bg-gray-50">{children}</div>;
}
