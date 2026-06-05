"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { ReservationStatus, STATUS_CLASS, STATUS_LABEL } from "@/lib/reservationStatus";
import { apiFetch, todayJst, toJstTime } from "@/lib/apiFetch";

type Reservation = {
  note_id: string;
  seq: number;
  time: string;
  clientName: string;
  clientId: string;
  menu: string;
  staffName: string;
  status: ReservationStatus;
};

type ApiReservation = {
  note_id: string;
  client: { client_id: string; client_name: string | null } | null;
  staff: { staff_id: string; staff_name: string | null } | null;
  status: ReservationStatus;
  reservation_start: string;
  main_menu: string;
};

export default function ClerkPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = todayJst();
        const res = await apiFetch(
          `/api/v1/reservations?date_from=${today}&date_to=${today}&per_page=100`
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(body?.error?.message ?? "予約の取得に失敗しました。");
          return;
        }
        const rows: ApiReservation[] = body.data ?? [];
        if (!cancelled) {
          setReservations(
            rows.map((r, i) => ({
              note_id: r.note_id,
              seq: i + 1,
              time: toJstTime(r.reservation_start),
              clientName: r.client?.client_name ?? "（不明）",
              clientId: r.client?.client_id ?? "",
              menu: r.main_menu,
              staffName: r.staff?.staff_name ?? "（未割当）",
              status: r.status,
            }))
          );
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function triggerRefresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleCheckIn() {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      await Promise.all(
        [...selected].map((noteId) =>
          apiFetch(`/api/v1/reservations/${noteId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "checked_in" }),
          })
        )
      );
      setSelected(new Set());
      triggerRefresh();
    } catch {
      setError("ステータス更新に失敗しました。");
    } finally {
      setActionLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const displayed = showDone
    ? reservations
    : reservations.filter((r) => r.status !== "done");

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
            <button
              onClick={handleCheckIn}
              disabled={selected.size === 0 || actionLoading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {actionLoading ? "処理中…" : "check in"}
            </button>
            {selected.size > 0 && (
              <span className="text-sm text-gray-600">{selected.size} 件選択中</span>
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
                  const doneIds = new Set(
                    reservations
                      .filter((r) => r.status === "done")
                      .map((r) => r.note_id)
                  );
                  setSelected((prev) =>
                    new Set([...prev].filter((id) => !doneIds.has(id)))
                  );
                }
              }}
              className="size-4 rounded border-gray-300"
            />
            会計済みを表示
          </label>
        </div>

        {/* ローディング / エラー */}
        {loading && (
          <p className="py-12 text-center text-sm text-gray-400">読み込み中…</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={triggerRefresh} className="ml-3 underline">
              再試行
            </button>
          </div>
        )}

        {/* 予約リスト */}
        {!loading && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="w-8 px-4 py-3">
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
                {displayed.map((r) => (
                  <tr
                    key={r.note_id}
                    className={`hover:bg-gray-50 ${r.status === "done" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.note_id)}
                        onChange={() => toggleSelect(r.note_id)}
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
                      {r.clientId && (
                        <Link
                          href={`/be_note/${r.clientId}`}
                          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          note
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {displayed.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400">
                当日の予約はありません
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
