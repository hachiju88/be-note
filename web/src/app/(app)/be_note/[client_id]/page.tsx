"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { ChevronRight, Paperclip, Plus, Send, X } from "lucide-react";
import { ReservationStatus, STATUS_CLASS, STATUS_LABEL } from "@/lib/reservationStatus";
import { MOCK_STAFF, MOCK_STAFF_NAMES } from "@/lib/mockStaff";

// ---- モックデータ ----

const MOCK_CLIENT = {
  clientName: "佐藤 美咲",
  clientKana: "サトウ ミサキ",
  sex: "女性",
  age: 32,
  rank: "S",
  totalVisit: 18,
};

type MenuItem = { name: string; staff: string; price: number; startTime?: string; endTime?: string };
type DiscountItem = { name: string; price: number };
type PhotoItem = { label: string; url: string };

type VisitNote = {
  id: string;
  date: string;
  staff: string;
  status: ReservationStatus;
  menus: MenuItem[];
  discounts: DiscountItem[];
  photos: PhotoItem[];
};

function noteTotal(note: VisitNote) {
  return (
    note.menus.reduce((s, m) => s + m.price, 0) +
    note.discounts.reduce((s, d) => s + d.price, 0)
  );
}

const INITIAL_VISITS: VisitNote[] = [
  {
    id: "n001",
    date: "2026-06-01 10:30",
    staff: "田中 太郎",
    status: "in_progress",
    menus: [
      { name: "カット", staff: "田中 太郎", price: 5500, startTime: "10:30", endTime: "11:30" },
      { name: "トリートメント", staff: "山本 さくら", price: 3300, startTime: "11:30", endTime: "12:00" },
    ],
    discounts: [{ name: "リピート割引", price: -550 }],
    photos: [
      { label: "Before", url: "" },
      { label: "After", url: "" },
    ],
  },
  {
    id: "n002",
    date: "2026-04-15 13:00",
    staff: "田中 太郎",
    status: "done",
    menus: [{ name: "カット＋カラー", staff: "田中 太郎", price: 12100 }],
    discounts: [],
    photos: [],
  },
  {
    id: "n003",
    date: "2026-02-20 11:00",
    staff: "鈴木 一郎",
    status: "done",
    menus: [{ name: "パーマ", staff: "鈴木 一郎", price: 9900 }],
    discounts: [{ name: "誕生日割引", price: -990 }],
    photos: [],
  },
];

type DmMessage = {
  id: string;
  text?: string;
  imageUrl?: string;
  isClient: boolean;
  time: string;
};

const INITIAL_DM: DmMessage[] = [
  { id: "m1", text: "次回もよろしくお願いします！", isClient: true, time: "4/15 14:00" },
  { id: "m2", text: "ありがとうございます。またのご来店をお待ちしております 😊", isClient: false, time: "4/15 15:30" },
  { id: "m3", text: "ヘアカタログを見ていたのですが、次回はハイライトを入れてみたいです", isClient: true, time: "5/20 10:00" },
  { id: "m4", text: "ハイライト、ぜひご相談しましょう！カウンセリングのお時間をとりますね", isClient: false, time: "5/20 11:00" },
];

const MOCK_FUTURE = [
  { date: "2026-07-05 11:00", menu: "カット＋ハイライト", staff: MOCK_STAFF[0].name },
];

// ---- 施術追加フォーム ----

type AddMenuFormProps = {
  onAdd: (item: MenuItem) => void;
  onCancel: () => void;
};

function AddMenuForm({ onAdd, onCancel }: AddMenuFormProps) {
  const [name, setName] = useState("");
  const [staff, setStaff] = useState(MOCK_STAFF_NAMES[0]);
  const [price, setPrice] = useState("");

  function handleSubmit() {
    const p = parseInt(price.replace(/,/g, ""), 10);
    if (!name.trim() || isNaN(p) || p < 0) return;
    onAdd({ name: name.trim(), staff, price: p });
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
            {MOCK_STAFF_NAMES.map((s) => (
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

// ---- 来店 note パネル ----

type VisitNotePanelProps = {
  note: VisitNote;
  onAddMenu: (item: MenuItem) => void;
};

function VisitNotePanel({ note, onAddMenu }: VisitNotePanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const subtotal = noteTotal(note);

  return (
    <div className="flex flex-col gap-4">
      {/* ヘッダ */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{note.date}</p>
          <p className="text-sm text-gray-600">担当：{note.staff}</p>
        </div>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[note.status] ?? "bg-gray-100 text-gray-500"}`}>
          {STATUS_LABEL[note.status] ?? note.status}
        </span>
      </div>

      {/* 施術明細 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">施術</h4>
          {note.status !== "done" && !showAddForm && (
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
          {note.menus.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-gray-800">{m.name}</p>
                <p className="text-xs text-gray-400">
                  {m.staff}{m.startTime && ` / ${m.startTime}〜${m.endTime}`}
                </p>
              </div>
              <span className="font-mono text-gray-700">¥{m.price.toLocaleString()}</span>
            </div>
          ))}
          {note.discounts.map((d, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <p className="text-gray-600">{d.name}</p>
              <span className="font-mono text-red-500">¥{d.price.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="mt-2">
            <AddMenuForm
              onAdd={(item) => { onAddMenu(item); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}
      </div>

      {/* 写真 */}
      {note.photos.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">写真</h4>
          <div className="flex gap-3">
            {note.photos.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="size-24 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  {p.label}
                </div>
                <span className="text-xs text-gray-400">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 合計・会計ボタン */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
        <div>
          <p className="text-xs text-gray-400">合計（税込）</p>
          <p className="text-xl font-bold text-gray-900">¥{subtotal.toLocaleString()}</p>
        </div>
        {note.status !== "done" && (
          <button className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <ChevronRight size={14} />
            会計
          </button>
        )}
      </div>
    </div>
  );
}

// ---- メインページ ----

export default function BeNotePage() {
  const params = useParams<{ client_id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clientId = params.client_id; // API 接続フェーズで使用

  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [selectedVisitId, setSelectedVisitId] = useState(INITIAL_VISITS[0].id);
  const [dmText, setDmText] = useState("");
  const [messages, setMessages] = useState(INITIAL_DM);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ref でレンダーごとに最新値を保持し、アンマウント時に未送信の objectURL を解放する
  // （useEffect の [] 依存ではクロージャが古くなるため ref パターンを使用）
  const pendingImageRef = useRef<string | null>(null);
  pendingImageRef.current = pendingImage;
  useEffect(() => {
    return () => {
      if (pendingImageRef.current) URL.revokeObjectURL(pendingImageRef.current);
    };
  }, []);

  const selectedVisit = visits.find((v) => v.id === selectedVisitId) ?? visits[0];

  function handleAddMenu(item: MenuItem) {
    setVisits((prev) =>
      prev.map((v) =>
        v.id === selectedVisitId
          ? { ...v, menus: [...v.menus, item] }
          : v
      )
    );
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    const url = URL.createObjectURL(file);
    setPendingImage(url);
    e.target.value = "";
  }

  function sendMessage() {
    if (!dmText.trim() && !pendingImage) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        text: dmText.trim() || undefined,
        imageUrl: pendingImage ?? undefined,
        isClient: false,
        time: "今",
      },
    ]);
    setDmText("");
    setPendingImage(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Be:note" navLinks={[{ label: "← メニュー", href: "/menu" }, { label: "← 戻る", href: "/clerk" }]} />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* 顧客ヘッダ */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold text-gray-900">{MOCK_CLIENT.clientName} 様</h2>
              <span className="text-sm text-gray-400">（{MOCK_CLIENT.clientKana}）</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{MOCK_CLIENT.sex} / {MOCK_CLIENT.age}歳</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                ランク {MOCK_CLIENT.rank}
              </span>
              <span>来店 {MOCK_CLIENT.totalVisit} 回目</span>
            </div>
          </div>
          <button className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            <ChevronRight size={14} />
            詳細情報
          </button>
        </div>

        {/* note + History 2カラム */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">来店 note</h3>
            {/* key でノート切替時に showAddForm などのローカル state をリセットする */}
            <VisitNotePanel key={selectedVisit.id} note={selectedVisit} onAddMenu={handleAddMenu} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">History</h3>
            <div className="flex flex-col gap-2">
              {visits.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVisitId(v.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    v.id === selectedVisitId
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="font-semibold text-gray-800">{v.date.slice(0, 10)}</p>
                  <p className="text-gray-500">{v.staff}</p>
                  <p className="text-gray-500">{v.menus[0]?.name}</p>
                  <p className="font-mono text-gray-700">¥{noteTotal(v).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DM エリア */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">DM（交換ノート）</h3>

          {/* メッセージ一覧 */}
          <div className="mb-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.isClient ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${
                  m.isClient ? "bg-gray-100 text-gray-800" : "bg-indigo-600 text-white"
                }`}>
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt="添付画像" className="mb-1 max-w-full rounded-lg" />
                  )}
                  {m.text && <p>{m.text}</p>}
                  <p className={`mt-0.5 text-xs ${m.isClient ? "text-gray-400" : "text-indigo-200"}`}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 画像プレビュー */}
          {pendingImage && (
            <div className="relative mb-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage} alt="添付プレビュー" className="h-20 rounded-lg border border-gray-200 object-cover" />
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

          {/* 入力フォーム */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
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
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="メッセージを入力..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={sendMessage}
              disabled={!dmText.trim() && !pendingImage}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              <Send size={14} />
              送信
            </button>
          </div>
        </div>

        {/* 未来予約 */}
        {MOCK_FUTURE.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">確定済み予約</h3>
            <div className="flex flex-col gap-2">
              {MOCK_FUTURE.map((f, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg bg-blue-50 px-4 py-3 text-sm">
                  <span className="font-medium text-blue-800">{f.date}</span>
                  <span className="text-blue-700">{f.menu}</span>
                  <span className="text-blue-600">{f.staff}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          ※ モックアップ。ダミーデータを表示しています。
        </p>
      </div>
    </div>
  );
}
