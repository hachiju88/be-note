"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { ChevronDown } from "lucide-react";
import { apiFetch, todayJst, toJstTime } from "@/lib/apiFetch";

type Task = {
  task_id: string;
  task_name: string;
  task_order: number;
};

type ApiReservation = {
  note_id: string;
  client: { client_id: string; client_name: string | null } | null;
  staff: { staff_id: string; staff_name: string | null } | null;
  status: string;
  reservation_start: string;
  reservation_end: string;
  main_menu: string;
  current_task_id: string | null;
};

type Card = {
  noteId: string;
  clientName: string;
  clientId: string;
  timeRange: string;
  menu: string;
  staffId: string;
  staffName: string;
  currentTaskId: string | null;
  isDone: boolean;
};

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = todayJst();
        const [tasksRes, activeRes, doneRes] = await Promise.all([
          apiFetch("/api/v1/masters/tasks"),
          apiFetch(`/api/v1/reservations?date_from=${today}&date_to=${today}&per_page=100`),
          apiFetch(`/api/v1/reservations?date_from=${today}&date_to=${today}&status=done&per_page=100`),
        ]);

        if (!tasksRes.ok || !activeRes.ok) throw new Error("データの取得に失敗しました。");

        const tasksJson = await tasksRes.json();
        const activeJson = await activeRes.json();
        const doneJson = doneRes.ok ? await doneRes.json() : { data: [] };

        const toCard = (r: ApiReservation): Card => ({
          noteId: r.note_id,
          clientName: r.client?.client_name ?? "（不明）",
          clientId: r.client?.client_id ?? "",
          timeRange: `${toJstTime(r.reservation_start)}〜${toJstTime(r.reservation_end)}`,
          menu: r.main_menu,
          staffId: r.staff?.staff_id ?? "",
          staffName: r.staff?.staff_name ?? "（未割当）",
          currentTaskId: r.current_task_id,
          isDone: r.status === "done",
        });

        const allRows: ApiReservation[] = [
          ...(activeJson.data ?? []),
          ...(doneJson.data ?? []),
        ];
        // 重複除去（active と done は status で絞っていないので status=done が active にも入る可能性あり）
        const seen = new Set<string>();
        const unique = allRows.filter((r) => {
          if (seen.has(r.note_id)) return false;
          seen.add(r.note_id);
          return true;
        });

        if (!cancelled) {
          setTasks((tasksJson.data ?? []) as Task[]);
          setCards(unique.map(toCard));
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
  }, [refreshKey]);

  function triggerRefresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleAdvanceTask(noteId: string, taskId: string) {
    setUpdatingCard(noteId);
    try {
      const res = await apiFetch(`/api/v1/reservations/${noteId}/task`, {
        method: "PATCH",
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) throw new Error("タスク更新失敗");
      setCards((prev) =>
        prev.map((c) =>
          c.noteId === noteId ? { ...c, currentTaskId: taskId } : c
        )
      );
    } catch {
      setError("タスクの更新に失敗しました。");
    } finally {
      setUpdatingCard(null);
    }
  }

  const activeCards = cards.filter((c) => !c.isDone);
  const doneCards = cards.filter((c) => c.isDone);

  // スタッフ別にアクティブカードをグループ化
  const staffMap = new Map<string, { staffName: string; cards: Card[] }>();
  for (const card of activeCards) {
    if (!staffMap.has(card.staffId)) {
      staffMap.set(card.staffId, { staffName: card.staffName, cards: [] });
    }
    staffMap.get(card.staffId)!.cards.push(card);
  }
  const staffEntries = [...staffMap.entries()];

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
        {loading && (
          <p className="py-12 text-center text-sm text-gray-400">読み込み中…</p>
        )}
        {error && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={triggerRefresh} className="ml-3 underline">
              再試行
            </button>
          </div>
        )}

        {/* ボード本体（横スクロール） */}
        {!loading && tasks.length > 0 && (
          <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table
              className="border-separate border-spacing-0 text-sm"
              style={{ minWidth: `${tasks.length * 144 + 140}px` }}
            >
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-36 border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-500">
                    スタッフ
                  </th>
                  {tasks.map((task) => (
                    <th
                      key={task.task_id}
                      className="w-36 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-center text-xs font-semibold text-gray-500"
                    >
                      {task.task_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tasks.length + 1}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      来店中の顧客はいません
                    </td>
                  </tr>
                ) : (
                  staffEntries.map(([staffId, { staffName, cards: staffCards }], idx) => (
                    <tr key={staffId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-inherit px-3 py-3">
                        <div className="text-xs font-medium text-gray-900">{staffName}</div>
                      </td>
                      {tasks.map((task) => {
                        const card = staffCards.find(
                          (c) =>
                            c.currentTaskId === task.task_id ||
                            (c.currentTaskId === null && taskIdx === 0)
                        );
                        const taskIdx = tasks.findIndex((t) => t.task_id === task.task_id);
                        const nextTask = tasks[taskIdx + 1];
                        return (
                          <td
                            key={task.task_id}
                            className="border-b border-r border-gray-200 p-1.5 align-top"
                            style={{ minHeight: "80px" }}
                          >
                            {card && (
                              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
                                <Link
                                  href={card.clientId ? `/be_note/${card.clientId}` : "#"}
                                  className="block hover:opacity-80"
                                >
                                  <div className="truncate text-xs font-semibold text-indigo-900">
                                    {card.clientName}
                                  </div>
                                  <div className="mt-0.5 text-xs text-indigo-600">
                                    {card.timeRange}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-gray-500">
                                    {card.menu}
                                  </div>
                                </Link>
                                {nextTask && (
                                  <button
                                    onClick={() =>
                                      handleAdvanceTask(card.noteId, nextTask.task_id)
                                    }
                                    disabled={updatingCard === card.noteId}
                                    className="mt-1 w-full rounded border border-indigo-300 bg-white px-1 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                                  >
                                    {updatingCard === card.noteId ? "…" : "→ 次へ"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* done 領域 */}
        {!loading && doneCards.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <button
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${showDone ? "rotate-180" : ""}`}
              />
              done（{doneCards.length}件）
            </button>
            {showDone && (
              <div className="mt-2 flex flex-wrap gap-3">
                {doneCards.map((card) => (
                  <div
                    key={card.noteId}
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
        )}
      </div>
    </div>
  );
}
