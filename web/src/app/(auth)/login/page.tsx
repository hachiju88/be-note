import { Suspense } from "react";
import LoginForm from "./LoginForm";

/**
 * ログイン画面（/login・未認証）。
 * Be:note 独自（メール＋パスワード） / Google / Instagram。LINE はフェーズ2。
 *
 * 認証済みユーザーの /login アクセスは middleware が /menu へ振り替える。
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Be:note</h1>
          <p className="mt-1 text-sm text-gray-500">管理ツール ログイン</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
