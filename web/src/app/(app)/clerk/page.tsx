"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { ReservationStatus, STATUS_CLASS, STATUS_LABEL } from "@/lib/reservationStatus";

type Reservation = {
  id: string;
  seq: number;
  time: string;
  clientName: string;
  clientId: string;
  menu: string;
  staffName: string;
  status: ReservationStatus;
};

const MOCK_RESERVATIONS: Reservation[] = [
  { id: "r001", seq: 1, time: "10:00", clientName: "山田 花子", clientId: "c001", menu: "カット＋カラー", staffName: "田中 太郎", status: "done" },
  { id: "r002", seq: 2, time: "10:30", clientName: "佐藤 美咲", clientId: "c002", menu: "カット", staffName: "鈴木 一郎", status: "in_progress" },
  { id: "r003", seq: 3, time: "11:00", clientName: "鈴木 啓介", clientId: "c003", menu: "パーマ", staffName: "田中 太郎", status: "checked_in" },
  { id: "r004", seq: 4, time: "13:00", clientName: "高橋 由美", clientId: "c004", menu: "トリートメント", staffName: "山本 さくら", status: "confirmed" },
  { id: "r005", seq: 5, time: "14:30", clientName: "伊藤 健太", clientId: "c005", menu: "カット＋パーマ", staffName: "鈴木 一郎", status: "confirmed" },
  { id: "r006", seq: 6, time: "15:00", clientName: "渡辺 陽子", clientId: "c006", menu: "カラー", staffName: "田中 太郎", status: "confirmed" },
  { id: "r007", seq: 7, time: "16:30", clientName: "中村 優", clientId: "c007", menu: "カット", staffName: "山本 さくら", status: "confirmed" },
];


export default function ClerkPage() {
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reservations = showDone
    ? MOCK_RESERVATIONS
    : MOCK_RESERVATIONS.filter((r) => r.status !== "done");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        title="予約受付"
        navLinks={[
          { label: "← メニュー", href: "/menu" },
          { label: "board", href: "/board" },
          { label: "reserve", href: "/reserve" },
        ]}
      />

      <div className="flex-1 p-6">
        {/* ツールバー */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              check in
            </button>
            {selected.size > 0 && (
              <span className="text-sm text-gray-600">
                {selected.size} 件選択中
              </span>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => {
                const next = e.target.checked;
                setShowDone(next);
                if (!next) {
                  // done 行を非表示にする際、選択状態から done の ID を除去する
                  const doneIds = new Set(
                    MOCK_RESERVATIONS.filter((r) => r.status === "done").map((r) => r.id)
                  );
                  setSelected((prev) => new Set([...prev].filter((id) => !doneIds.has(id))));
                }
              }}
              className="size-4 rounded border-gray-300"
            />
            会計済みを表示
          </label>
        </div>

        {/* 予約リスト */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 w-8">
                  <span className="sr-only">選択</span>
                </th>
                <th className="px-4 py-3">受付 No.</th>
                <th className="px-4 py-3">予約時間</th>
                <th className="px-4 py-3">顧客名</th>
                <th className="px-4 py-3">メニュー</th>
                <th className="px-4 py-3">担当</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 ${r.status === "done" ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="size-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {String(r.seq).padStart(3, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.time}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.clientName}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.menu}</td>
                  <td className="px-4 py-3 text-gray-600">{r.staffName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/be_note/${r.clientId}`}
                      className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      note
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {reservations.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">
              当日の予約はありません
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          ※ モックアップ。ダミーデータを表示しています。
        </p>
      </div>
    </div>
  );
}
