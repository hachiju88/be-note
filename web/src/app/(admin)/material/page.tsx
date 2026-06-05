"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { AlertTriangle, Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

type Material = {
  material_id: string;
  material_name: string;
  unit: string;
  current_stock: number;
  reorder_point: number;
  low_stock: boolean;
};

type TxType = "in" | "out" | "adjust";
const TX_LABEL: Record<TxType, string> = { in: "入庫", out: "出庫", adjust: "棚卸調整" };

export default function MaterialPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const [txType, setTxType] = useState<TxType>("in");
  const [txQty, setTxQty] = useState("");
  const [txMemo, setTxMemo] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch(
          `/api/v1/materials${lowOnly ? "?low_stock_only=true" : ""}`
        );
        if (!res.ok) throw new Error("材料一覧の取得に失敗しました。");
        const json = await res.json();
        if (!cancelled) { setMaterials(json.data ?? []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, lowOnly]);

  function triggerRefresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleTransaction() {
    if (!selected) return;
    const qty = parseFloat(txQty);
    if (isNaN(qty) || (txType === "adjust" ? qty < 0 : qty <= 0)) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await apiFetch(
        `/api/v1/materials/${selected.material_id}/transactions`,
        {
          method: "POST",
          body: JSON.stringify({
            transaction_type: txType,
            quantity: qty,
            memo: txMemo.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "登録に失敗しました。");
      }
      setTxQty("");
      setTxMemo("");
      triggerRefresh();
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "登録に失敗しました。");
    } finally {
      setTxLoading(false);
    }
  }

  const displayed = lowOnly
    ? materials.filter((m) => m.low_stock)
    : materials;

  const lowCount = materials.filter((m) => m.low_stock).length;

  const qty = parseFloat(txQty);
  const txQtyInvalid =
    txQty === "" || isNaN(qty) || (txType === "adjust" ? qty < 0 : qty <= 0);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="材料管理"
        navLinks={[{ label: "← メニュー", href: "/menu" }]}
      />

      <div className="flex flex-1 gap-4 p-6">
        {/* 材料一覧 */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lowCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600">
                  <AlertTriangle size={12} />
                  低在庫 {lowCount} 件
                </span>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={lowOnly}
                  onChange={(e) => setLowOnly(e.target.checked)}
                  className="size-4 rounded border-gray-300"
                />
                低在庫のみ表示
              </label>
            </div>
            <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              <Plus size={14} />
              材料を追加
            </button>
          </div>

          {/* エラー / ローディング */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button onClick={triggerRefresh} className="ml-3 underline">
                再試行
              </button>
            </div>
          )}
          {loading && (
            <p className="py-12 text-center text-sm text-gray-400">読み込み中…</p>
          )}

          {!loading && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">材料名</th>
                    <th className="px-4 py-3 text-right">現在庫</th>
                    <th className="px-4 py-3 text-right">発注点</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-sm text-gray-400"
                      >
                        材料がありません
                      </td>
                    </tr>
                  )}
                  {displayed.map((m) => (
                    <tr
                      key={m.material_id}
                      onClick={() => setSelected(m)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selected?.material_id === m.material_id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {m.material_name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-semibold ${
                            m.low_stock ? "text-red-600" : "text-gray-800"
                          }`}
                        >
                          {m.current_stock} {m.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400">
                        {m.reorder_point} {m.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.low_stock && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                            <AlertTriangle size={10} />
                            要発注
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 入出庫パネル */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">入出庫登録</h3>

            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
                  {selected.material_name}
                  <span className="ml-2 font-mono text-xs text-indigo-500">
                    {
                      // 最新の在庫を表示（再取得後に materials から引く）
                      (materials.find((m) => m.material_id === selected.material_id)
                        ?.current_stock ?? selected.current_stock)
                    }{" "}
                    {selected.unit}
                  </span>
                </div>

                <div className="flex gap-1">
                  {(["in", "out", "adjust"] as TxType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTxType(t)}
                      className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
                        txType === t
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {TX_LABEL[t]}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  placeholder={txType === "adjust" ? "調整後の数量" : "数量"}
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="text"
                  placeholder="メモ（任意）"
                  value={txMemo}
                  onChange={(e) => setTxMemo(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />

                {txError && (
                  <p className="text-xs text-red-600">{txError}</p>
                )}

                <button
                  onClick={handleTransaction}
                  disabled={txQtyInvalid || txLoading}
                  className="rounded bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {txLoading ? "登録中…" : "登録"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                左の一覧から材料を選択してください
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
