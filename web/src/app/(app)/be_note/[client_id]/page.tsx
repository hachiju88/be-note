"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { ChevronRight, Paperclip, Plus, Send, X } from "lucide-react";
import { ReservationStatus, STATUS_CLASS, STATUS_LABEL } from "@/lib/reservationStatus";
import { apiFetch, toJstDatetime, toJstTime } from "@/lib/apiFetch";

// ---- 型定義 ----

type ClientInfo = {
  client_id: string;
  client_name: string;
  client_kana: string;
  sex: string | null;
  age: number | null;
  salon_info: {
    client_rank: string | null;
    total_visit: number | null;
  } | null;
};

type ReservationChild = {
  note_id: string;
  note_type: "reservation";
  reservation_start: string;
  reservation_end: string;
  main_menu: string;
  status: ReservationStatus;
  total: number | null;
};

type OtherChild = {
  note_id: string;
  note_type: string;
};

type HeadNote = {
  note_id: string;
  responsible: { staff_id: string; staff_name: string | null };
  creation_datetime: string;
  future_flg: boolean;
  children: (ReservationChild | OtherChild)[];
};

type MenuItem = {
  menu_id: string;
  menu_name: string;
  staff: { staff_id: string; staff_name: string | null } | null;
  price: number;
  start_time: string | null;
  end_time: string | null;
};

type ReservationDetail = {
  reservation_start: string | null;
  reservation_end: string | null;
  main_menu: string | null;
  status: ReservationStatus | null;
  total: number | null;
  menu_list: MenuItem[];
  actual_start: string | null;
  actual_end: string | null;
  payment_method: string | null;
};

type DmMessage = {
  note_id: string;
  text: string;
  is_client: boolean;
  creation_datetime: string;
};

type FutureReservation = {
  noteId: string;
  start: string;
  menu: string;
  staffName: string;
};

// ---- AddMenuForm ----

type AddMenuFormProps = {
  staffOptions: string[];
  onAdd: (name: string, staffName: string, price: number) => void;
  onCancel: () => void;
};

function AddMenuForm({ staffOptions, onAdd, onCancel }: AddMenuFormProps) {
  const [name, setName] = useState("");
  const [staff, setStaff] = useState(staffOptions[0] ?? "");
  const [price, setPrice] = useState("");

  function handleSubmit() {
    const p = parseInt(price.replace(/,/g, ""), 10);
    if (!name.trim() || isNaN(p) || p < 0) return;
    onAdd(name.trim(), staff, p);
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
      <div className="flex flex-col gap-2">
        <input
          autoFocus
          type="text"
          placeholder="メニュー名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="flex gap-2">
          <select
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {staffOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="金額（税込）"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-36 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !price}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- メインページ ----

export default function BeNotePage() {
  const params = useParams<{ client_id: string }>();
  const clientId = params.client_id;

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [headNotes, setHeadNotes] = useState<HeadNote[]>([]);
  const [futureNotes, setFutureNotes] = useState<FutureReservation[]>([]);
  const [selectedHeadId, setSelectedHeadId] = useState<string | null>(null);
  const [visitDetail, setVisitDetail] = useState<ReservationDetail | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmText, setDmText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sendingDm, setSendingDm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageRef = useRef<string | null>(null);

  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);
  useEffect(() => {
    return () => {
      if (pendingImageRef.current) URL.revokeObjectURL(pendingImageRef.current);
    };
  }, []);

  // 初回: 顧客情報・past notes・future notes を並行取得
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      // clientId 切替時に前の顧客データをクリアしてから新規取得する。
      setHeadNotes([]);
      setSelectedHeadId(null);
      setVisitDetail(null);
      setDmMessages([]);
      setFutureNotes([]);
      setLoading(true);
      setError(null);
      try {
        const [clientRes, pastRes, futureRes] = await Promise.all([
          apiFetch(`/api/v1/clients/${clientId}`),
          apiFetch(`/api/v1/clients/${clientId}/notes?future_flg=false&per_page=20`),
          apiFetch(`/api/v1/clients/${clientId}/notes?future_flg=true&per_page=10`),
        ]);

        if (cancelled) return;

        if (clientRes.ok) {
          const j = await clientRes.json();
          setClientInfo(j.data ?? null);
        }

        if (pastRes.ok) {
          const j = await pastRes.json();
          const rows: HeadNote[] = j.data ?? [];
          setHeadNotes(rows);
          if (rows.length > 0 && !selectedHeadId) {
            setSelectedHeadId(rows[0].note_id);
          }
        }

        if (futureRes.ok) {
          const j = await futureRes.json();
          const rows: HeadNote[] = j.data ?? [];
          const futures: FutureReservation[] = rows.flatMap((h) =>
            (h.children as (ReservationChild | OtherChild)[])
              .filter((c): c is ReservationChild => c.note_type === "reservation")
              .map((c) => ({
                noteId: c.note_id,
                start: c.reservation_start,
                menu: c.main_menu,
                staffName: h.responsible.staff_name ?? "（不明）",
              }))
          );
          setFutureNotes(futures);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "データの取得に失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
    // selectedHeadId は初回のみ設定するため依存から除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // selectedHeadId が変わったら予約詳細と DM を取得
  useEffect(() => {
    if (!selectedHeadId) return;
    const head = headNotes.find((h) => h.note_id === selectedHeadId);
    if (!head) return;

    const reservationChild = (
      head.children as (ReservationChild | OtherChild)[]
    ).find((c): c is ReservationChild => c.note_type === "reservation");

    const textChildren = (head.children as (ReservationChild | OtherChild)[])
      .filter((c) => c.note_type === "text")
      .map((c) => c.note_id);

    let cancelled = false;

    async function fetchDetail() {
      setDetailLoading(true);
      setVisitDetail(null);
      setDmMessages([]);
      try {
        const fetches: Promise<void>[] = [];

        // 予約詳細
        if (reservationChild) {
          fetches.push(
            apiFetch(`/api/v1/clients/${clientId}/notes/${reservationChild.note_id}`)
              .then((r) => r.json())
              .then((j) => { if (!cancelled) setVisitDetail(j.data ?? null); })
              .catch(() => {})
          );
        }

        // DM（テキストノード最大10件）
        if (textChildren.length > 0) {
          fetches.push(
            Promise.all(
              textChildren.slice(-10).map((noteId) =>
                apiFetch(`/api/v1/clients/${clientId}/notes/${noteId}`)
                  .then((r) => r.json())
                  .then((j) => j.data as DmMessage & { note_id: string } | null)
                  .catch(() => null)
              )
            ).then((results) => {
              if (cancelled) return;
              const msgs: DmMessage[] = results
                .filter((r): r is DmMessage & { note_id: string } => !!r)
                .sort((a, b) =>
                  a.creation_datetime < b.creation_datetime ? -1 : 1
                );
              setDmMessages(msgs);
            })
          );
        }

        await Promise.all(fetches);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [selectedHeadId, headNotes, clientId]);

  async function sendDm() {
    if (!dmText.trim() && !pendingImage) return;
    if (!selectedHeadId) return;
    setSendingDm(true);
    try {
      const res = await apiFetch(`/api/v1/clients/${clientId}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note_type: "text",
          p_note_id: selectedHeadId,
          text: dmText.trim() || "（画像）",
        }),
      });
      if (!res.ok) throw new Error("送信失敗");
      const { data: created } = await res.json();
      setDmMessages((prev) => [
        ...prev,
        {
          note_id: created.note_id,
          text: dmText.trim() || "（画像）",
          is_client: false,
          creation_datetime: new Date().toISOString(),
        },
      ]);
      setDmText("");
      if (pendingImage) {
        URL.revokeObjectURL(pendingImage);
        setPendingImage(null);
      }
    } catch {
      setError("DM の送信に失敗しました。");
    } finally {
      setSendingDm(false);
    }
  }

  const selectedHead = headNotes.find((h) => h.note_id === selectedHeadId);
  const subtotal = visitDetail
    ? (visitDetail.menu_list?.reduce((s, m) => s + m.price, 0) ?? 0)
    : null;

  const staffOptions: string[] = [];
  if (visitDetail?.menu_list) {
    const names = new Set<string>();
    for (const m of visitDetail.menu_list) {
      if (m.staff?.staff_name) names.add(m.staff.staff_name);
    }
    staffOptions.push(...names);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Be:note"
        navLinks={[
          { label: "← メニュー", href: "/menu" },
          { label: "← 戻る", href: "/clerk" },
        ]}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {loading && (
          <p className="py-12 text-center text-sm text-gray-400">読み込み中…</p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* 顧客ヘッダ */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {clientInfo?.client_name ?? "（不明）"} 様
                  </h2>
                  {clientInfo?.client_kana && (
                    <span className="text-sm text-gray-400">
                      （{clientInfo.client_kana}）
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  {clientInfo?.sex && <span>{clientInfo.sex}</span>}
                  {clientInfo?.age != null && <span>{clientInfo.age}歳</span>}
                  {clientInfo?.salon_info?.client_rank && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      ランク {clientInfo.salon_info.client_rank}
                    </span>
                  )}
                  {clientInfo?.salon_info?.total_visit != null && (
                    <span>来店 {clientInfo.salon_info.total_visit} 回</span>
                  )}
                </div>
              </div>
              <button className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                <ChevronRight size={14} />
                詳細情報
              </button>
            </div>

            {/* note + History 2カラム */}
            <div className="grid grid-cols-3 gap-4">
              {/* 来店 note */}
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">来店 note</h3>
                {detailLoading && (
                  <p className="text-sm text-gray-400">読み込み中…</p>
                )}
                {!detailLoading && !visitDetail && (
                  <p className="text-sm text-gray-400">履歴を選択してください。</p>
                )}
                {!detailLoading && visitDetail && (
                  <div className="flex flex-col gap-4">
                    {/* ヘッダ */}
                    <div className="flex items-center justify-between">
                      <div>
                        {visitDetail.reservation_start && (
                          <p className="text-sm text-gray-500">
                            {toJstDatetime(visitDetail.reservation_start)}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          担当：{selectedHead?.responsible.staff_name ?? "（不明）"}
                        </p>
                      </div>
                      {visitDetail.status && (
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[visitDetail.status] ?? "bg-gray-100 text-gray-500"}`}
                        >
                          {STATUS_LABEL[visitDetail.status] ?? visitDetail.status}
                        </span>
                      )}
                    </div>

                    {/* 施術明細 */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          施術
                        </h4>
                        {visitDetail.status !== "done" && !showAddForm && (
                          <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            <Plus size={12} />
                            追加
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                        {visitDetail.menu_list?.map((m) => (
                          <div
                            key={m.menu_id}
                            className="flex items-center justify-between px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-gray-800">{m.menu_name}</p>
                              <p className="text-xs text-gray-400">
                                {m.staff?.staff_name}
                                {m.start_time &&
                                  ` / ${toJstTime(m.start_time)}〜${m.end_time ? toJstTime(m.end_time) : ""}`}
                              </p>
                            </div>
                            <span className="font-mono text-gray-700">
                              ¥{m.price.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {(!visitDetail.menu_list || visitDetail.menu_list.length === 0) && (
                          <p className="px-3 py-2 text-sm text-gray-400">施術なし</p>
                        )}
                      </div>
                      {showAddForm && (
                        <div className="mt-2">
                          <AddMenuForm
                            staffOptions={staffOptions.length ? staffOptions : ["担当スタッフ"]}
                            onAdd={(name, staffName, price) => {
                              // ローカル表示のみ追加（API 未実装分）
                              setVisitDetail((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      menu_list: [
                                        ...prev.menu_list,
                                        {
                                          menu_id: `local-${Date.now()}`,
                                          menu_name: name,
                                          staff: { staff_id: "", staff_name: staffName },
                                          price,
                                          start_time: null,
                                          end_time: null,
                                        },
                                      ],
                                    }
                                  : prev
                              );
                              setShowAddForm(false);
                            }}
                            onCancel={() => setShowAddForm(false)}
                          />
                        </div>
                      )}
                    </div>

                    {/* 合計・会計ボタン */}
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-xs text-gray-400">合計（税込）</p>
                        <p className="text-xl font-bold text-gray-900">
                          ¥{(subtotal ?? 0).toLocaleString()}
                        </p>
                      </div>
                      {visitDetail.status !== "done" && (
                        <button className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                          <ChevronRight size={14} />
                          会計
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* History */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">History</h3>
                <div className="flex flex-col gap-2">
                  {headNotes.map((h) => {
                    const resChild = (
                      h.children as (ReservationChild | OtherChild)[]
                    ).find((c): c is ReservationChild => c.note_type === "reservation");
                    return (
                      <button
                        key={h.note_id}
                        onClick={() => setSelectedHeadId(h.note_id)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          h.note_id === selectedHeadId
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <p className="font-semibold text-gray-800">
                          {toJstDatetime(h.creation_datetime).slice(0, 10)}
                        </p>
                        <p className="text-gray-500">
                          {h.responsible.staff_name ?? "（不明）"}
                        </p>
                        {resChild && (
                          <>
                            <p className="text-gray-500">{resChild.main_menu}</p>
                            {resChild.total != null && (
                              <p className="font-mono text-gray-700">
                                ¥{resChild.total.toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                  {headNotes.length === 0 && (
                    <p className="text-sm text-gray-400">来店履歴はありません。</p>
                  )}
                </div>
              </div>
            </div>

            {/* DM エリア */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">DM（交換ノート）</h3>

              <div className="mb-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
                {dmMessages.map((m) => (
                  <div
                    key={m.note_id}
                    className={`flex ${m.is_client ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-xs rounded-xl px-3 py-2 text-sm ${
                        m.is_client
                          ? "bg-gray-100 text-gray-800"
                          : "bg-indigo-600 text-white"
                      }`}
                    >
                      <p>{m.text}</p>
                      <p
                        className={`mt-0.5 text-xs ${
                          m.is_client ? "text-gray-400" : "text-indigo-200"
                        }`}
                      >
                        {toJstDatetime(m.creation_datetime).slice(5)}
                      </p>
                    </div>
                  </div>
                ))}
                {dmMessages.length === 0 && (
                  <p className="text-sm text-gray-400">メッセージはありません。</p>
                )}
              </div>

              {pendingImage && (
                <div className="relative mb-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImage}
                    alt="添付プレビュー"
                    className="h-20 rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(pendingImage);
                      setPendingImage(null);
                    }}
                    className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-gray-600 text-white hover:bg-gray-800"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (pendingImage) URL.revokeObjectURL(pendingImage);
                    setPendingImage(URL.createObjectURL(file));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-gray-500 hover:bg-gray-50"
                  title="画像を添付"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendDm()}
                  placeholder="メッセージを入力…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  disabled={!selectedHeadId}
                />
                <button
                  onClick={sendDm}
                  disabled={(!dmText.trim() && !pendingImage) || !selectedHeadId || sendingDm}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Send size={14} />
                  {sendingDm ? "送信中…" : "送信"}
                </button>
              </div>
            </div>

            {/* 確定済み予約 */}
            {futureNotes.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">確定済み予約</h3>
                <div className="flex flex-col gap-2">
                  {futureNotes.map((f) => (
                    <div
                      key={f.noteId}
                      className="flex items-center gap-4 rounded-lg bg-blue-50 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-blue-800">
                        {toJstDatetime(f.start)}
                      </span>
                      <span className="text-blue-700">{f.menu}</span>
                      <span className="text-blue-600">{f.staffName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
