import Link from "next/link";

/**
 * 管理ツール共通ヘッダ。
 * ログイン中のユーザー情報（メール / ロール）とログアウトボタンを表示する。
 */
export default function AppHeader({
  title,
  email,
  role,
}: {
  title: string;
  email: string | null;
  role: string;
}) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3 text-sm">
      <Link href="/menu" className="font-semibold">
        {title}
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-gray-500">
          {email}（{role}）
        </span>
        {/* ログアウトは POST のみ受け付ける Route Handler を叩く。 */}
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}
