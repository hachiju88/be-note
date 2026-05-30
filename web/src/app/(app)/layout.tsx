/**
 * (app) グループ: staff / admin 向けレイアウト。
 * 認証・ロールガード（staff 以上）は実装フェーズで middleware / Server 側に追加する。
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b px-6 py-3 text-sm font-semibold">
        Be:note 管理ツール（staff / admin）
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
