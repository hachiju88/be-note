"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const MASTER_TYPES = [
  { key: "menus", label: "メニュー" },
  { key: "tasks", label: "工程" },
  { key: "staff", label: "スタッフ" },
  { key: "staff-skills", label: "可能タスク" },
  { key: "business-hours", label: "営業時間" },
  { key: "holidays", label: "休業" },
  { key: "shifts", label: "シフト" },
  { key: "slots", label: "予約枠" },
] as const;

type MasterKey = (typeof MASTER_TYPES)[number]["key"];
type Row = Record<string, unknown>;

/** レスポンスの行を画面表示用に変換するカラム定義 */
const COLUMN_DEFS: Record<MasterKey, { label: string; field: string }[]> = {
  menus: [
    { label: "メニュー名", field: "menu_name" },
    { label: "種別", field: "kinds" },
    { label: "基本料金", field: "base_price" },
    { label: "所要時間(分)", field: "duration_minutes" },
  ],
  tasks: [
    { label: "工程名", field: "task_name" },
    { label: "順序", field: "task_order" },
    { label: "担当制限", field: "role_limit" },
  ],
  staff: [
    { label: "氏名", field: "staff_name" },
    { label: "カナ", field: "staff_kana" },
    { label: "職位", field: "position" },
    { label: "管理者", field: "is_admin" },
  ],
  "staff-skills": [
    { label: "スタッフ ID", field: "staff_id" },
    { label: "タスク ID", field: "task_id" },
  ],
  "business-hours": [
    { label: "曜日", field: "day_of_week" },
    { label: "開店", field: "open_time" },
    { label: "閉店", field: "close_time" },
  ],
  holidays: [
    { label: "日付", field: "holiday_date" },
    { label: "理由", field: "reason" },
  ],
  shifts: [
    { label: "スタッフ ID", field: "staff_id" },
    { label: "日付", field: "shift_date" },
    { label: "開始", field: "start_time" },
    { label: "終了", field: "end_time" },
  ],
  slots: [{ label: "予約枠名", field: "slot_name" }],
};

/** ID カラムのフィールド名（削除 API に使う） */
const ID_FIELD: Record<MasterKey, string> = {
  menus: "menu_master_id",
  tasks: "task_id",
  staff: "staff_id",
  "staff-skills": "staff_id", // 複合キー
  "business-hours": "day_of_week",
  holidays: "holiday_date",
  shifts: "shift_id",
  slots: "slot_id",
};

/** 曜日ラベル */
const DOW_LABEL: Record<number, string> = {
  0: "日", 1: "月", 2: "火", 3: "水", 4: "木", 5: "金", 6: "土",
};

function formatCell(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "is_admin") return value ? "✓" : "";
  if (field === "day_of_week") return DOW_LABEL[value as number] ?? String(value);
  if (field === "base_price" || field === "sales")
    return `¥${Number(value).toLocaleString()}`;
  return String(value);
}

export default function MasterPage() {
  const [activeKey, setActiveKey] = useState<MasterKey>("menus");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns = COLUMN_DEFS[activeKey];

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch(`/api/v1/masters/${activeKey}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "マスタの取得に失敗しました。");
        }
        const json = await res.json();
        if (!cancelled) { setRows(json.data ?? []); setError(null); }
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : "不明なエラーが発生しました。"); setRows([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeKey, refreshKey]);

  function handleKeyChange(key: MasterKey) {
    setLoading(true);
    setError(null);
    setRows([]);
    setActiveKey(key);
  }

  function triggerRefresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(row: Row) {
    const idField = ID_FIELD[activeKey];
    const id = activeKey === "staff-skills"
      ? `${row.staff_id}-${row.task_id}`
      : String(row[idField] ?? "");
    if (!id) return;
    if (!confirm("削除してよろしいですか？")) return;

    setDeletingId(id);
    try {
      let url = `/api/v1/masters/${activeKey}`;
      if (activeKey === "staff-skills") {
        url += `?staff_id=${row.staff_id}&task_id=${row.task_id}`;
      } else {
        url += `/${id}`;
      }
      const res = await apiFetch(url, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "削除に失敗しました。");
      }
      triggerRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="マスタメンテ"
        navLinks={[{ label: "← メニュー", href: "/menu" }]}
      />

      <div className="flex flex-1">
        {/* 左サイドバー */}
        <nav className="w-44 shrink-0 border-r border-gray-200 bg-white py-4">
          {MASTER_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleKeyChange(key)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                activeKey === key
                  ? "border-r-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* 右コンテンツ */}
        <div className="flex-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              {MASTER_TYPES.find((m) => m.key === activeKey)?.label}
            </h2>
            <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              <Plus size={14} />
              新規追加
            </button>
          </div>

          {/* エラー */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button
                onClick={triggerRefresh}
                className="ml-3 underline"
              >
                再試行
              </button>
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <p className="py-12 text-center text-sm text-gray-400">読み込み中…</p>
          )}

          {!loading && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {columns.map((col) => (
                      <th key={col.field} className="px-4 py-3">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="py-12 text-center text-sm text-gray-400"
                      >
                        データがありません
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => {
                    const idField = ID_FIELD[activeKey];
                    const rowId = activeKey === "staff-skills"
                      ? `${row.staff_id}-${row.task_id}`
                      : String(row[idField] ?? i);
                    return (
                      <tr key={rowId} className="hover:bg-gray-50">
                        {columns.map((col) => (
                          <td key={col.field} className="px-4 py-3 text-gray-700">
                            {formatCell(col.field, row[col.field])}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="text-gray-400 hover:text-indigo-600">
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              disabled={deletingId === rowId}
                              className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
