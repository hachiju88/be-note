import { requireAdmin } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

/**
 * (admin) グループ: admin 専用レイアウト。
 * requireAdmin() で admin（t_staff.is_admin = true）を強制する。
 * admin 以外は /menu へ退避する。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, role } = await requireAdmin();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Be:note 管理者メニュー" email={email} role={role} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
