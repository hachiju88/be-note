import { requireStaff } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";

/**
 * (app) グループ: staff / admin 向けレイアウト。
 * requireStaff() で staff 以上を強制する（未認証→/login、customer→退避）。
 * 取得したセッション情報を SessionProvider で配下に渡し、AppHeader 等が
 * 実ロール・スタッフ名を表示できるようにする。
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStaff();

  return (
    <SessionProvider
      value={{ staffName: ctx.staffName, email: ctx.email, role: ctx.role }}
    >
      <div className="flex min-h-screen flex-col bg-gray-50">{children}</div>
    </SessionProvider>
  );
}
