"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { TrendingUp, Users, CreditCard, Scissors } from "lucide-react";
import { apiFetch, todayJst } from "@/lib/apiFetch";

type StaffSales = {
  staff_id: string;
  staff_name: string | null;
  sales: number;
  treatment_count: number;
};

type MenuSales = {
  menu_master_id: string | null;
  menu_name: string;
  count: number;
  sales: number;
};

type PaymentBreakdown = { method: string; amount: number };

type ReportData = {
  period: { date_from: string; date_to: string };
  summary: {
    sales_total: number;
    customer_count: number;
    average_spend: number;
    cancel_count: number;
    no_show_count: number;
  };
  payment_breakdown: PaymentBreakdown[];
  by_staff: StaffSales[];
  by_menu: MenuSales[];
};

export default function ReportPage() {
  const today = todayJst();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初回: 当日の日報を自動取得
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const t = todayJst();
      try {
        const res = await apiFetch(`/api/v1/reports/daily?date_from=${t}&date_to=${t}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body?.error?.message ?? "日報の取得に失敗しました。");
          return;
        }
        const json = await res.json();
        if (!cancelled) { setReport(json.data ?? null); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/v1/reports/daily?date_from=${dateFrom}&date_to=${dateTo}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "日報の取得に失敗しました。");
      }
      const json = await res.json();
      setReport(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  const summary = report?.summary;
  const CARDS = summary
    ? [
        {
          label: "売上合計",
          value: `¥${summary.sales_total.toLocaleString()}`,
          sub: `来客 ${summary.customer_count} 名`,
          Icon: TrendingUp,
          color: "text-indigo-600 bg-indigo-50",
        },
        {
          label: "来客数",
          value: `${summary.customer_count} 名`,
          sub: `キャンセル ${summary.cancel_count} 件`,
          Icon: Users,
          color: "text-green-600 bg-green-50",
        },
        {
          label: "客単価",
          value: `¥${summary.average_spend.toLocaleString()}`,
          sub: "",
          Icon: Scissors,
          color: "text-amber-600 bg-amber-50",
        },
        {
          label: "支払方法",
          value:
            report!.payment_breakdown.length > 0
              ? report!.payment_breakdown
                  .map((p) => `${p.method} ¥${p.amount.toLocaleString()}`)
                  .join(" / ")
              : "—",
          sub: "",
          Icon: CreditCard,
          color: "text-purple-600 bg-purple-50",
        },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="日報管理"
        navLinks={[{ label: "← メニュー", href: "/menu" }]}
      />

      <div className="flex-1 p-6">
        {/* 期間選択 */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-sm text-gray-400">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {loading ? "集計中…" : "集計"}
          </button>
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <p className="py-12 text-center text-sm text-gray-400">集計中…</p>
        )}

        {!loading && report && (
          <>
            {/* サマリカード */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {CARDS.map(({ label, value, sub, Icon, color }) => (
                <div
                  key={label}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 items-center justify-center rounded-lg ${color}`}
                    >
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
                <h3 className="mb-4 text-sm font-semibold text-gray-700">
                  スタッフ別実績
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-400">
                      <th className="pb-2">スタッフ</th>
                      <th className="pb-2 text-right">件数</th>
                      <th className="pb-2 text-right">売上</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.by_staff.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">
                          データなし
                        </td>
                      </tr>
                    )}
                    {report.by_staff.map((s) => (
                      <tr key={s.staff_id}>
                        <td className="py-2 text-gray-800">
                          {s.staff_name ?? "（不明）"}
                        </td>
                        <td className="py-2 text-right text-gray-600">
                          {s.treatment_count} 件
                        </td>
                        <td className="py-2 text-right font-mono text-gray-800">
                          ¥{s.sales.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* メニュー別売上 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">
                  メニュー別売上
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-400">
                      <th className="pb-2">メニュー</th>
                      <th className="pb-2 text-right">件数</th>
                      <th className="pb-2 text-right">売上</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.by_menu.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">
                          データなし
                        </td>
                      </tr>
                    )}
                    {report.by_menu.map((m, i) => (
                      <tr key={m.menu_master_id ?? i}>
                        <td className="py-2 text-gray-800">{m.menu_name}</td>
                        <td className="py-2 text-right text-gray-600">
                          {m.count} 件
                        </td>
                        <td className="py-2 text-right font-mono text-gray-800">
                          ¥{m.sales.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && !report && !error && (
          <p className="py-12 text-center text-sm text-gray-400">
            期間を選択して「集計」を押してください。
          </p>
        )}
      </div>
    </div>
  );
}
