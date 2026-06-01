import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const STAFF_MENUS = [
  {
    href: "/clerk",
    label: "予約受付",
    description: "当日の予約一覧・来店処理",
    icon: "📋",
  },
  {
    href: "/board",
    label: "予約ボード",
    description: "来店中の施術進捗管理",
    icon: "🗂️",
  },
  {
    href: "/reserve",
    label: "予約管理",
    description: "予約の参照・編集・タイムライン",
    icon: "📅",
  },
];

const ADMIN_MENUS = [
  {
    href: "/report",
    label: "日報管理",
    description: "売上・施術の日次レポート",
    icon: "📊",
  },
  {
    href: "/material",
    label: "材料管理",
    description: "在庫・仕入れの管理",
    icon: "📦",
  },
  {
    href: "/master",
    label: "マスタメンテ",
    description: "メニュー・スタッフ・営業時間等の設定",
    icon: "⚙️",
  },
];

// モックアップ: 実装フェーズで認証セッションから取得する
const MOCK_IS_ADMIN = true;

export default function MenuPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="メニュー" />

      <main className="flex-1 p-8">
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            日常業務
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STAFF_MENUS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <span className="text-3xl">{item.icon}</span>
                <span className="text-lg font-semibold text-gray-900">
                  {item.label}
                </span>
                <span className="text-sm text-gray-500">{item.description}</span>
              </Link>
            ))}
          </div>
        </section>

        {MOCK_IS_ADMIN && (
          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              管理者メニュー
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ADMIN_MENUS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {item.label}
                  </span>
                  <span className="text-sm text-gray-500">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
