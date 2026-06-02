"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";

type Props = {
  title: string;
  navLinks?: { label: string; href: string }[];
  /** 通常は SessionProvider から取得するため未指定でよい（明示時は上書き）。 */
  email?: string | null;
  role?: string;
};

export default function AppHeader({ title, navLinks = [], email, role }: Props) {
  // ログイン中スタッフの実情報（layout の SessionProvider 由来）。props があれば優先。
  const session = useSession();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const formatted = now
    ? now.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const displayName =
    email ?? session?.staffName ?? session?.email ?? "ゲスト";
  const displayRole = role ?? session?.role ?? "staff";
  const initial = displayName.charAt(0);

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        <span className="text-sm text-gray-500">{formatted}</span>
      </div>

      <div className="flex items-center gap-3">
        {navLinks.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            {label}
          </Link>
        ))}
        <div className="ml-4 flex items-center gap-2 text-sm text-gray-600">
          <span className="flex size-7 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            {initial}
          </span>
          <span>{displayName}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {displayRole}
          </span>
        </div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}
