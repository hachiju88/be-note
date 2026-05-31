import { requireStaff } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

/**
 * (app) グループ: staff / admin 向けレイアウト。
 * requireStaff() で staff 以上を強制する（未認証→/login、customer→退避）。
 * middleware は「ログイン済みか」までを見るので、ロール判定はここ（Server）で行う。
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, role } = await requireStaff();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Be:note 管理ツール" email={email} role={role} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
