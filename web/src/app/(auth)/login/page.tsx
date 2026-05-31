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
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-8">
      <h1 className="text-2xl font-bold">Be:note 管理ツール</h1>
      <p className="mt-1 text-sm text-gray-600">ログインしてください。</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
