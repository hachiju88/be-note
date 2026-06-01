"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { ChevronDown } from "lucide-react";
import { MOCK_STAFF, ROLE_LABEL } from "@/lib/mockStaff";

const TASKS = [
  "check in",
  "wash",
  "cut",
  "special wash",
  "treatment",
  "blow dry",
  "after cut",
  "finish",
  "check out",
];

type Card = {
  id: string;
  clientName: string;
  clientId: string;
  timeRange: string;
  menu: string;
  staffId: string;
  taskIndex: number;
};

const MOCK_CARDS: Card[] = [
  { id: "c001", clientName: "佐藤 美咲", clientId: "cl002", timeRange: "10:30〜11:30", menu: "カット", staffId: "s002", taskIndex: 4 },
  { id: "c002", clientName: "鈴木 啓介", clientId: "cl003", timeRange: "11:00〜13:00", menu: "パーマ", staffId: "s001", taskIndex: 2 },
  { id: "c003", clientName: "高橋 由美", clientId: "cl004", timeRange: "13:00〜14:00", menu: "トリートメント", staffId: "s003", taskIndex: 1 },
];

const MOCK_DONE_CARDS: Card[] = [
  { id: "d001", clientName: "山田 花子", clientId: "cl001", timeRange: "10:00〜11:00", menu: "カット＋カラー", staffId: "s001", taskIndex: 8 },
];

// O(1) ルックアップ用 Map: `${staffId}:${taskIndex}` → Card
const CARD_MAP = new Map(
  MOCK_CARDS.map((c) => [`${c.staffId}:${c.taskIndex}`, c])
);

export default function BoardPage() {
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="予約ボード"
        navLinks={[
          { label: "← メニュー", href: "/menu" },
          { label: "clerk", href: "/clerk" },
          { label: "reserve", href: "/reserve" },
        ]}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* ツールバー */}
        <div className="flex items-center gap-3">
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            check in
          </button>
        </div>

        {/* ボード本体（横スクロール） */}
        <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table
            className="border-separate border-spacing-0 text-sm"
            style={{ minWidth: `${TASKS.length * 144 + 140}px` }}
          >
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-36 border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-500">
                  スタッフ
                </th>
                {TASKS.map((task) => (
                  <th
                    key={task}
                    className="w-36 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-center text-xs font-semibold text-gray-500"
                  >
                    {task}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_STAFF.map((staff, staffIdx) => (
                <tr key={staff.id} className={staffIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-inherit px-3 py-3">
                    <div className="text-xs font-medium text-gray-900">{staff.name}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{ROLE_LABEL[staff.role]}</div>
                  </td>
                  {TASKS.map((task, taskIdx) => {
                    const card = CARD_MAP.get(`${staff.id}:${taskIdx}`);
                    return (
                      <td
                        key={task}
                        className="border-b border-r border-gray-200 p-1.5 align-top"
                        style={{ minHeight: "80px" }}
                      >
                        {card && (
                          <Link
                            href={`/be_note/${card.clientId}`}
                            className="block rounded-lg border border-indigo-200 bg-indigo-50 p-2 transition-colors hover:bg-indigo-100"
                          >
                            <div className="truncate text-xs font-semibold text-indigo-900">
                              {card.clientName}
                            </div>
                            <div className="mt-0.5 text-xs text-indigo-600">{card.timeRange}</div>
                            <div className="mt-0.5 truncate text-xs text-gray-500">{card.menu}</div>
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* done 領域 */}
        <div className="border-t border-gray-200 pt-3">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${showDone ? "rotate-180" : ""}`}
            />
            done（{MOCK_DONE_CARDS.length}件）
          </button>
          {showDone && (
            <div className="mt-2 flex flex-wrap gap-3">
              {MOCK_DONE_CARDS.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500"
                >
                  <div className="font-semibold text-gray-700">{card.clientName}</div>
                  <div>{card.timeRange}</div>
                  <div>{card.menu}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          ※ モックアップ。ダミーデータを表示しています。
        </p>
      </div>
    </div>
  );
}
