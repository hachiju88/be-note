/**
 * (admin) グループ: admin 専用レイアウト。
 * admin ロールガード（t_staff.is_admin から導出）は実装フェーズで追加する。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b px-6 py-3 text-sm font-semibold">
        Be:note 管理者メニュー（admin）
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
