"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Pencil, Plus, Trash2 } from "lucide-react";

const MASTER_TYPES = [
  { key: "menus", label: "メニュー" },
  { key: "tasks", label: "工程" },
  { key: "staff", label: "スタッフ" },
  { key: "staff-skills", label: "可能タスク" },
  { key: "business-hours", label: "営業時間" },
  { key: "holidays", label: "休業" },
  { key: "shifts", label: "シフト" },
  { key: "slots", label: "予約枠" },
  { key: "materials", label: "材料" },
] as const;

type MasterKey = (typeof MASTER_TYPES)[number]["key"];

type Row = Record<string, string | number>;

const MOCK_DATA: Record<MasterKey, { columns: string[]; rows: Row[] }> = {
  menus: {
    columns: ["メニュー名", "種別", "基本料金", "所要時間"],
    rows: [
      { メニュー名: "カット", 種別: "cut", 基本料金: "¥5,500", 所要時間: "60分" },
      { メニュー名: "カット＋カラー", 種別: "color", 基本料金: "¥12,100", 所要時間: "120分" },
      { メニュー名: "パーマ", 種別: "perm", 基本料金: "¥9,900", 所要時間: "150分" },
      { メニュー名: "トリートメント", 種別: "treatment", 基本料金: "¥3,300", 所要時間: "30分" },
    ],
  },
  tasks: {
    columns: ["工程名", "順序", "担当制限"],
    rows: [
      { 工程名: "check in", 順序: 1, 担当制限: "なし" },
      { 工程名: "wash", 順序: 2, 担当制限: "なし" },
      { 工程名: "cut", 順序: 3, 担当制限: "スタイリスト" },
      { 工程名: "treatment", 順序: 5, 担当制限: "なし" },
      { 工程名: "blow dry", 順序: 6, 担当制限: "なし" },
      { 工程名: "finish", 順序: 8, 担当制限: "スタイリスト" },
      { 工程名: "check out", 順序: 9, 担当制限: "なし" },
    ],
  },
  staff: {
    columns: ["氏名", "カナ", "職位", "管理者"],
    rows: [
      { 氏名: "田中 太郎", カナ: "タナカ タロウ", 職位: "stylist", 管理者: "✓" },
      { 氏名: "鈴木 一郎", カナ: "スズキ イチロウ", 職位: "stylist", 管理者: "" },
      { 氏名: "山本 さくら", カナ: "ヤマモト サクラ", 職位: "assistant", 管理者: "" },
    ],
  },
  "staff-skills": {
    columns: ["スタッフ", "工程", "権限"],
    rows: [
      { スタッフ: "田中 太郎", 工程: "cut", 権限: "✓" },
      { スタッフ: "田中 太郎", 工程: "finish", 権限: "✓" },
      { スタッフ: "鈴木 一郎", 工程: "cut", 権限: "✓" },
      { スタッフ: "鈴木 一郎", 工程: "finish", 権限: "✓" },
    ],
  },
  "business-hours": {
    columns: ["曜日", "開店", "閉店"],
    rows: [
      { 曜日: "月", 開店: "10:00", 閉店: "20:00" },
      { 曜日: "火", 開店: "10:00", 閉店: "20:00" },
      { 曜日: "水", 開店: "定休日", 閉店: "—" },
      { 曜日: "木", 開店: "10:00", 閉店: "20:00" },
      { 曜日: "金", 開店: "10:00", 閉店: "20:00" },
      { 曜日: "土", 開店: "09:00", 閉店: "19:00" },
      { 曜日: "日", 開店: "09:00", 閉店: "18:00" },
    ],
  },
  holidays: {
    columns: ["日付", "理由"],
    rows: [
      { 日付: "2026-08-13", 理由: "お盆休み" },
      { 日付: "2026-08-14", 理由: "お盆休み" },
      { 日付: "2026-12-31", 理由: "年末休業" },
    ],
  },
  shifts: {
    columns: ["スタッフ", "日付", "開始", "終了"],
    rows: [
      { スタッフ: "田中 太郎", 日付: "2026-06-01", 開始: "09:30", 終了: "19:00" },
      { スタッフ: "鈴木 一郎", 日付: "2026-06-01", 開始: "10:00", 終了: "19:30" },
      { スタッフ: "山本 さくら", 日付: "2026-06-01", 開始: "10:00", 終了: "18:00" },
    ],
  },
  slots: {
    columns: ["予約枠名"],
    rows: [
      { 予約枠名: "通常" },
      { 予約枠名: "指名" },
      { 予約枠名: "ご紹介" },
    ],
  },
  materials: {
    columns: ["材料名", "単位", "発注点"],
    rows: [
      { 材料名: "カラー剤 アッシュブラウン", 単位: "本", 発注点: 5 },
      { 材料名: "パーマ液 1剤", 単位: "本", 発注点: 4 },
      { 材料名: "トリートメント剤", 単位: "kg", 発注点: 2 },
      { 材料名: "シャンプー業務用", 単位: "L", 発注点: 3 },
    ],
  },
};

export default function MasterPage() {
  const [activeKey, setActiveKey] = useState<MasterKey>("menus");
  const master = MOCK_DATA[activeKey];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="マスタメンテ" navLinks={[{ label: "← メニュー", href: "/menu" }]} />

      <div className="flex flex-1">
        {/* 左サイドバー */}
        <nav className="w-44 shrink-0 border-r border-gray-200 bg-white py-4">
          {MASTER_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveKey(key)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                activeKey === key
                  ? "bg-indigo-50 font-semibold text-indigo-700 border-r-2 border-indigo-600"
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

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {master.columns.map((col) => (
                    <th key={col} className="px-4 py-3">{col}</th>
                  ))}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {master.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {master.columns.map((col) => (
                      <td key={col} className="px-4 py-3 text-gray-700">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-indigo-600">
                          <Pencil size={14} />
                        </button>
                        <button className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-gray-400">※ モックアップ。ダミーデータを表示しています。</p>
        </div>
      </div>
    </div>
  );
}
