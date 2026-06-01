"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";

// 営業時間 9:00〜20:00、15分刻み
const START_HOUR = 9;
const END_HOUR = 20;
const SLOT_MIN = 15;
const SLOT_HEIGHT = 20; // px per slot
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN; // 44

function timeToSlot(hour: number, min: number) {
  return ((hour - START_HOUR) * 60 + min) / SLOT_MIN;
}

function slotToLabel(slot: number) {
  const totalMin = START_HOUR * 60 + slot * SLOT_MIN;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Reservation = {
  id: string;
  clientName: string;
  clientId: string;
  menu: string;
  staffId: string;
  startSlot: number;
  durationSlots: number;
};

const MOCK_STAFF = [
  { id: "s001", name: "田中 太郎", role: "stylist" },
  { id: "s002", name: "鈴木 一郎", role: "stylist" },
  { id: "s003", name: "山本 さくら", role: "assistant" },
];

const MOCK_RESERVATIONS: Reservation[] = [
  { id: "r001", clientName: "山田 花子", clientId: "cl001", menu: "カット＋カラー", staffId: "s001", startSlot: timeToSlot(10, 0), durationSlots: 6 },
  { id: "r002", clientName: "佐藤 美咲", clientId: "cl002", menu: "カット", staffId: "s002", startSlot: timeToSlot(10, 30), durationSlots: 4 },
  { id: "r003", clientName: "鈴木 啓介", clientId: "cl003", menu: "パーマ", staffId: "s001", startSlot: timeToSlot(13, 0), durationSlots: 8 },
  { id: "r004", clientName: "高橋 由美", clientId: "cl004", menu: "トリートメント", staffId: "s003", startSlot: timeToSlot(13, 0), durationSlots: 4 },
  { id: "r005", clientName: "伊藤 健太", clientId: "cl005", menu: "カット＋パーマ", staffId: "s002", startSlot: timeToSlot(14, 30), durationSlots: 6 },
  { id: "r006", clientName: "渡辺 陽子", clientId: "cl006", menu: "カラー", staffId: "s001", startSlot: timeToSlot(15, 0), durationSlots: 8 },
  { id: "r007", clientName: "中村 優", clientId: "cl007", menu: "カット", staffId: "s003", startSlot: timeToSlot(16, 30), durationSlots: 4 },
];

// 時間ラベル表示は毎時・毎30分のみ
function shouldShowLabel(slot: number) {
  return slot % 2 === 0;
}

export default function ReservePage() {
  const [selectedStaff, setSelectedStaff] = useState("all");

  const displayStaff =
    selectedStaff === "all"
      ? MOCK_STAFF
      : MOCK_STAFF.filter((s) => s.id === selectedStaff);

  const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="予約管理"
        navLinks={[
          { label: "clerk", href: "/clerk" },
          { label: "board", href: "/board" },
        ]}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* ツールバー */}
        <div className="flex items-center gap-3">
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            check in
          </button>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All</option>
            {MOCK_STAFF.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* タイムライングリッド */}
        <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
          <div className="flex">
            {/* 時間軸（sticky left） */}
            <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-gray-200 bg-white">
              {/* スタッフ名行ヘッダの高さ分の空白 */}
              <div className="h-10 border-b border-gray-200" />
              <div className="relative" style={{ height: totalHeight }}>
                {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
                  <div
                    key={slot}
                    className="absolute left-0 right-0 flex items-start"
                    style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    {shouldShowLabel(slot) && (
                      <span className="pl-2 pt-0.5 text-xs text-gray-400 leading-none">
                        {slotToLabel(slot)}
                      </span>
                    )}
                    {/* 目盛り線 */}
                    <div
                      className={`absolute right-0 border-t w-2 ${
                        slot % 4 === 0
                          ? "border-gray-300"
                          : "border-gray-100"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* スタッフ列 */}
            {displayStaff.map((staff) => {
              const staffReservations = MOCK_RESERVATIONS.filter(
                (r) => r.staffId === staff.id
              );
              return (
                <div
                  key={staff.id}
                  className="relative min-w-40 flex-1 border-r border-gray-200 last:border-r-0"
                >
                  {/* スタッフ名ヘッダ */}
                  <div className="sticky top-0 z-10 h-10 border-b border-gray-200 bg-gray-50 px-3 flex items-center">
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{staff.name}</div>
                      <div className="text-xs text-gray-400">
                        {staff.role === "stylist" ? "スタイリスト" : "アシスタント"}
                      </div>
                    </div>
                  </div>

                  {/* タイムラインセル */}
                  <div className="relative" style={{ height: totalHeight }}>
                    {/* グリッド線 */}
                    {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
                      <div
                        key={slot}
                        className={`absolute left-0 right-0 border-t ${
                          slot % 4 === 0
                            ? "border-gray-200"
                            : "border-gray-100"
                        }`}
                        style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      />
                    ))}

                    {/* 予約ブロック */}
                    {staffReservations.map((r) => (
                      <div
                        key={r.id}
                        className="absolute left-1 right-1 overflow-hidden rounded border border-indigo-300 bg-indigo-100 px-1.5 py-1 hover:bg-indigo-200 cursor-pointer transition-colors"
                        style={{
                          top: r.startSlot * SLOT_HEIGHT + 1,
                          height: r.durationSlots * SLOT_HEIGHT - 2,
                        }}
                      >
                        <div className="text-xs font-semibold text-indigo-900 truncate leading-tight">
                          {r.clientName}
                        </div>
                        <div className="text-xs text-indigo-600 leading-tight">
                          {slotToLabel(r.startSlot)}〜{slotToLabel(r.startSlot + r.durationSlots)}
                        </div>
                        <div className="text-xs text-gray-500 truncate leading-tight">
                          {r.menu}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-gray-400">
          ※ モックアップ。ダミーデータを表示しています。
        </p>
      </div>
    </div>
  );
}
