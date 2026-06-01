"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { AlertTriangle, Plus } from "lucide-react";

type Material = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  reorderPoint: number;
};

const INITIAL_MATERIALS: Material[] = [
  { id: "m1", name: "カラー剤 アッシュブラウン", unit: "本", stock: 3, reorderPoint: 5 },
  { id: "m2", name: "カラー剤 ナチュラルブラック", unit: "本", stock: 12, reorderPoint: 5 },
  { id: "m3", name: "パーマ液 1剤", unit: "本", stock: 2, reorderPoint: 4 },
  { id: "m4", name: "トリートメント剤", unit: "kg", stock: 1.5, reorderPoint: 2 },
  { id: "m5", name: "シャンプー業務用", unit: "L", stock: 8, reorderPoint: 3 },
  { id: "m6", name: "アルミホイル", unit: "巻", stock: 6, reorderPoint: 2 },
  { id: "m7", name: "使い捨て手袋", unit: "箱", stock: 1, reorderPoint: 3 },
];

type TxType = "in" | "out" | "adjust";
const TX_LABEL: Record<TxType, string> = { in: "入庫", out: "出庫", adjust: "棚卸調整" };

export default function MaterialPage() {
  const [materials, setMaterials] = useState(INITIAL_MATERIALS);
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const [txType, setTxType] = useState<TxType>("in");
  const [txQty, setTxQty] = useState("");
  const [txMemo, setTxMemo] = useState("");

  const displayed = lowOnly
    ? materials.filter((m) => m.stock <= m.reorderPoint)
    : materials;

  function handleTransaction() {
    const qty = parseFloat(txQty);
    if (!selected || isNaN(qty) || qty <= 0) return;
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== selected.id) return m;
        const delta = txType === "in" ? qty : txType === "out" ? -qty : qty - m.stock;
        return { ...m, stock: Math.max(0, m.stock + delta) };
      })
    );
    setTxQty("");
    setTxMemo("");
  }

  const lowCount = materials.filter((m) => m.stock <= m.reorderPoint).length;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="材料管理" navLinks={[{ label: "← メニュー", href: "/menu" }]} />

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
                {displayed.map((m) => {
                  const isLow = m.stock <= m.reorderPoint;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className={`cursor-pointer hover:bg-gray-50 ${selected?.id === m.id ? "bg-indigo-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-semibold ${isLow ? "text-red-600" : "text-gray-800"}`}>
                          {m.stock} {m.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400">
                        {m.reorderPoint} {m.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isLow && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                            <AlertTriangle size={10} />
                            要発注
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 入出庫パネル */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">入出庫登録</h3>

            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
                  {selected.name}
                  <span className="ml-2 font-mono text-xs text-indigo-500">
                    現在庫: {selected.stock} {selected.unit}
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
                <button
                  onClick={handleTransaction}
                  disabled={!txQty}
                  className="rounded bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  登録
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">左の一覧から材料を選択してください</p>
            )}
          </div>
        </div>
      </div>

      <p className="px-6 pb-4 text-xs text-gray-400">※ モックアップ。ダミーデータを表示しています。</p>
    </div>
  );
}
