import { redirect } from "next/navigation";

/**
 * ルート。認証状態に応じた振り分けは実装フェーズで行う。
 * 現状は未認証起点として /login へ誘導する。
 */
export default function Home() {
  redirect("/login");
}
