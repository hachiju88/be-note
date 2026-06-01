import AppHeader from "@/components/AppHeader";
import { TrendingUp, Users, CreditCard, Scissors } from "lucide-react";

const SUMMARY = [
  { label: "売上合計", value: "¥128,600", sub: "前日比 +12%", Icon: TrendingUp, color: "text-indigo-600 bg-indigo-50" },
  { label: "来客数", value: "14 名", sub: "うちキャンセル 1", Icon: Users, color: "text-green-600 bg-green-50" },
  { label: "客単価", value: "¥9,185", sub: "", Icon: Scissors, color: "text-amber-600 bg-amber-50" },
  { label: "支払方法", value: "現金 6 / カード 7 / QR 1", sub: "", Icon: CreditCard, color: "text-purple-600 bg-purple-50" },
];

const STAFF_SALES = [
  { name: "田中 太郎", count: 6, sales: 62400 },
  { name: "鈴木 一郎", count: 5, sales: 44800 },
  { name: "山本 さくら", count: 3, sales: 21400 },
];

const MENU_SALES = [
  { name: "カット", count: 7, sales: 38500 },
  { name: "カット＋カラー", count: 4, sales: 48400 },
  { name: "パーマ", count: 2, sales: 19800 },
  { name: "トリートメント", count: 3, sales: 9900 },
  { name: "カット＋パーマ", count: 1, sales: 12000 },
];

export default function ReportPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="日報管理" navLinks={[{ label: "← メニュー", href: "/menu" }]} />

      <div className="flex-1 p-6">
        {/* 期間選択 */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="date"
            defaultValue="2026-06-01"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-sm text-gray-400">〜</span>
          <input
            type="date"
            defaultValue="2026-06-01"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            集計
          </button>
        </div>

        {/* サマリカード */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SUMMARY.map(({ label, value, sub, Icon, color }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className={`flex size-9 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={18} />
                </span>
                <span className="text-sm text-gray-500">{label}</span>
              </div>
              <p className="mt-3 text-xl font-bold text-gray-900">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* スタッフ別実績 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">スタッフ別実績</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-400">
                  <th className="pb-2">スタッフ</th>
                  <th className="pb-2 text-right">件数</th>
                  <th className="pb-2 text-right">売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {STAFF_SALES.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 text-gray-800">{s.name}</td>
                    <td className="py-2 text-right text-gray-600">{s.count} 件</td>
                    <td className="py-2 text-right font-mono text-gray-800">¥{s.sales.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* メニュー別売上 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">メニュー別売上</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-400">
                  <th className="pb-2">メニュー</th>
                  <th className="pb-2 text-right">件数</th>
                  <th className="pb-2 text-right">売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MENU_SALES.map((m) => (
                  <tr key={m.name}>
                    <td className="py-2 text-gray-800">{m.name}</td>
                    <td className="py-2 text-right text-gray-600">{m.count} 件</td>
                    <td className="py-2 text-right font-mono text-gray-800">¥{m.sales.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">※ モックアップ。ダミーデータを表示しています。</p>
      </div>
    </div>
  );
}
