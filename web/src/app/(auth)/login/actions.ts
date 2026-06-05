"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/url";

/**
 * ログイン関連の Server Actions。
 *
 * - メール＋パスワード（Be:note 独自）
 * - OAuth（Google / Instagram）。LINE はフェーズ2のため未対応。
 */

export type LoginState = { error: string | null };

/**
 * メール＋パスワードでサインインする Server Action。
 * 成功時は next（既定 /menu）へリダイレクト。失敗時はエラーを state に返す。
 */
export async function signInWithPassword(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(formData.get("next"));

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 認証失敗の詳細は伏せ、汎用メッセージを返す。
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  redirect(next);
}

/**
 * OAuth（Google / Instagram）でサインインする Server Action。
 * Supabase が返す認可 URL へリダイレクトし、コールバックは /auth/callback で受ける。
 */
export async function signInWithOAuth(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const next = safeInternalPath(formData.get("next"));

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

/**
 * サインアウト Server Action。
 * サーバー側で Cookie を削除してからログイン画面へリダイレクトする。
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
