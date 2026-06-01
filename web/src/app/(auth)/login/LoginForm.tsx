"use client";

import { useActionState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  signInWithPassword,
  signInWithOAuth,
  type LoginState,
} from "./actions";

const INITIAL_STATE: LoginState = { error: null };

/**
 * ログインフォーム（Client Component）。
 * - メール＋パスワードは useActionState で Server Action を呼び、エラーを表示。
 * - OAuth は各プロバイダのボタンから Server Action へ POST する。
 * - forbidden エラー時はサインアウトボタンを表示してセッションをクリアする。
 */
export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") ?? "/menu";
  const urlError = searchParams.get("error");

  const [state, formAction, pending] = useActionState(
    signInWithPassword,
    INITIAL_STATE,
  );

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // forbidden: customer など権限なしユーザーがリダイレクトされてきた場合
  if (urlError === "forbidden") {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          このアカウントには管理ツールへのアクセス権がありません。
        </p>
        <button
          onClick={handleSignOut}
          className="w-full rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          サインアウト
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {urlError === "oauth" && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          外部ログインに失敗しました。時間をおいて再度お試しください。
        </p>
      )}

      {/* メール＋パスワード */}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">メールアドレス</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">パスワード</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="rounded border px-3 py-2"
          />
        </label>

        {state.error && (
          <p className="text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "ログイン中…" : "ログイン"}
        </button>
      </form>

      {/* 区切り */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        または
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {/* OAuth */}
      <div className="flex flex-col gap-2">
        <form action={signInWithOAuth}>
          <input type="hidden" name="provider" value="google" />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Google でログイン
          </button>
        </form>
        <form action={signInWithOAuth}>
          <input type="hidden" name="provider" value="instagram" />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Instagram でログイン
          </button>
        </form>
      </div>
    </div>
  );
}
