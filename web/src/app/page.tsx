import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

/**
 * ルート。認証状態に応じて振り分ける。
 * 認証済み（staff/admin）→ /menu、それ以外 → /login。
 * （middleware でも保護しているが、ルートの明示的な入口として扱う）
 */
export default async function Home() {
  const ctx = await getAuthContext();
  if (ctx && ctx.role !== "customer") {
    redirect("/menu");
  }
  redirect("/login");
}
