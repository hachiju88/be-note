import { requireAdmin } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";

/**
 * (admin) グループ: admin 専用レイアウト。
 * requireAdmin() で admin（t_staff.is_admin = true）を強制する。
 * admin 以外は /menu へ退避する。
 * 取得したセッション情報を SessionProvider で配下に渡す。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAdmin();

  return (
    <SessionProvider
      value={{ staffName: ctx.staffName, email: ctx.email, role: ctx.role }}
    >
      <div className="flex min-h-screen flex-col bg-gray-50">{children}</div>
    </SessionProvider>
  );
}
