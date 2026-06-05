"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { apiFetch, todayJst } from "@/lib/apiFetch";

// 営業時間 9:00〜20:00、15分刻み
const START_HOUR = 9;
const END_HOUR = 20;
const SLOT_MIN = 15;
const SLOT_HEIGHT = 20; // px per slot
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN; // 44

function timeToSlot(isoUtc: string): number {
  const jst = new Date(new Date(isoUtc).getTime() + 9 * 60 * 60 * 1000);
  return ((jst.getUTCHours() - START_HOUR) * 60 + jst.getUTCMinutes()) / SLOT_MIN;
}

function durationSlots(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / (SLOT_MIN * 60_000);
}

function slotToLabel(slot: number) {
  const totalMin = START_HOUR * 60 + slot * SLOT_MIN;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function shouldShowLabel(slot: number) {
  return slot % 2 === 0;
}

type ApiReservation = {
  note_id: string;
  client: { client_id: string; client_name: string | null } | null;
  staff: { staff_id: string; staff_name: string | null } | null;
  status: string;
  reservation_start: string;
  reservation_end: string;
  main_menu: string;
};

type Reservation = {
  id: string;
  clientName: string;
  clientId: string;
  menu: string;
  staffId: string;
  startSlot: number;
  durationSlots: number;
};

type StaffInfo = { staff_id: string; staff_name: string };

export default function ReservePage() {
  const [selectedDate, setSelectedDate] = useState(todayJst());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [staffList, setStaffList] = useState<StaffInfo[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch(
          `/api/v1/reservations?date_from=${selectedDate}&date_to=${selectedDate}&per_page=100`
        );
        if (!res.ok) throw new Error("予約の取得に失敗しました。");
        const json = await res.json();
        const rows: ApiReservation[] = json.data ?? [];

        const staffMap = new Map<string, string>();
        for (const r of rows) {
          if (r.staff?.staff_id) {
            staffMap.set(r.staff.staff_id, r.staff.staff_name ?? "（不明）");
          }
        }

        if (!cancelled) {
          setStaffList(
            [...staffMap.entries()].map(([staff_id, staff_name]) => ({
              staff_id,
              staff_name,
            }))
          );
          setReservations(
            rows
              .filter((r) => r.staff?.staff_id)
              .map((r) => ({
                id: r.note_id,
                clientName: r.client?.client_name ?? "（不明）",
                clientId: r.client?.client_id ?? "",
                menu: r.main_menu,
                staffId: r.staff!.staff_id,
                startSlot: timeToSlot(r.reservation_start),
                durationSlots: durationSlots(r.reservation_start, r.reservation_end),
              }))
          );
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedDate, refreshKey]);

  function handleDateChange(date: string) {
    setLoading(true);
    setError(null);
    setSelectedDate(date);
  }

  function triggerRefresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  const displayStaff =
    selectedStaff === "all"
      ? staffList
      : staffList.filter((s) => s.staff_id === selectedStaff);

  const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="予約管理"
        navLinks={[
          { label: "← メニュー", href: "/menu" },
          { label: "clerk", href: "/clerk" },
          { label: "board", href: "/board" },
        ]}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* ツールバー */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All</option>
            {staffList.map((s) => (
              <option key={s.staff_id} value={s.staff_id}>
                {s.staff_name}
              </option>
            ))}
          </select>
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

        {/* タイムライングリッド */}
        {!loading && (
          <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
            {displayStaff.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">
                この日の予約はありません
              </p>
            ) : (
              <div className="flex">
                {/* 時間軸（sticky left） */}
                <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-gray-200 bg-white">
                  <div className="sticky top-0 z-20 h-10 border-b border-gray-200 bg-white" />
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
                        <div
                          className={`absolute right-0 border-t w-2 ${
                            slot % 4 === 0 ? "border-gray-300" : "border-gray-100"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* スタッフ列 */}
                {displayStaff.map((staff) => {
                  const staffReservations = reservations.filter(
                    (r) => r.staffId === staff.staff_id
                  );
                  return (
                    <div
                      key={staff.staff_id}
                      className="relative min-w-40 flex-1 border-r border-gray-200 last:border-r-0"
                    >
                      <div className="sticky top-0 z-10 h-10 border-b border-gray-200 bg-gray-50 px-3 flex items-center">
                        <div className="text-xs font-semibold text-gray-800">
                          {staff.staff_name}
                        </div>
                      </div>

                      <div className="relative" style={{ height: totalHeight }}>
                        {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
                          <div
                            key={slot}
                            className={`absolute left-0 right-0 border-t ${
                              slot % 4 === 0 ? "border-gray-200" : "border-gray-100"
                            }`}
                            style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                          />
                        ))}

                        {staffReservations.map((r) => (
                          <div
                            key={r.id}
                            className="absolute left-1 right-1 overflow-hidden rounded border border-indigo-300 bg-indigo-100 px-1.5 py-1 hover:bg-indigo-200 cursor-pointer transition-colors"
                            style={{
                              top: r.startSlot * SLOT_HEIGHT + 1,
                              height: r.durationSlots * SLOT_HEIGHT - 2,
                            }}
                            title={`${r.clientName} / ${r.menu}`}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
