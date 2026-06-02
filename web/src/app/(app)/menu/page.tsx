import Link from "next/link";
import {
  ClipboardList,
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  Package,
  Settings,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getAuthContext } from "@/lib/auth";

const STAFF_MENUS = [
  {
    href: "/clerk",
    label: "予約受付",
    description: "当日の予約一覧・来店処理",
    Icon: ClipboardList,
  },
  {
    href: "/board",
    label: "予約ボード",
    description: "来店中の施術進捗管理",
    Icon: LayoutDashboard,
  },
  {
    href: "/reserve",
    label: "予約管理",
    description: "予約の参照・編集・タイムライン",
    Icon: CalendarDays,
  },
];

const ADMIN_MENUS = [
  {
    href: "/report",
    label: "日報管理",
    description: "売上・施術の日次レポート",
    Icon: BarChart2,
  },
  {
    href: "/material",
    label: "材料管理",
    description: "在庫・仕入れの管理",
    Icon: Package,
  },
  {
    href: "/master",
    label: "マスタメンテ",
    description: "メニュー・スタッフ・営業時間等の設定",
    Icon: Settings,
  },
];

type MenuItem = {
  href: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

function MenuCard({ href, label, description, Icon }: MenuItem) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
          <Icon size={20} />
        </span>
        <span className="text-base font-semibold text-gray-900">{label}</span>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}

export default async function MenuPage() {
  // (app)/layout の requireStaff を通過済み。ロールで管理者メニューを出し分ける。
  const ctx = await getAuthContext();
  const isAdmin = ctx?.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="メニュー" />

      <main className="flex-1 p-8">
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            日常業務
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STAFF_MENUS.map((item) => (
              <MenuCard key={item.href} {...item} />
            ))}
          </div>
        </section>

        {isAdmin && (
          <section className="mt-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              管理者メニュー
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ADMIN_MENUS.map((item) => (
                <MenuCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
