"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/auth";

/**
 * ログイン中スタッフの表示用セッション情報（Client Component 向け）。
 *
 * (app)/(admin) の layout（Server Component）が requireStaff/requireAdmin で
 * 取得した認証コンテキストを、この Provider 経由で配下のクライアント画面
 * （AppHeader 等）へ渡す。クライアントから DB を引かずにロール差分表示できる。
 */
export type SessionInfo = {
  staffName: string | null;
  email: string | null;
  role: Role;
};

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionInfo;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Provider 配下のクライアント画面でセッション情報を取得する。 */
export function useSession(): SessionInfo | null {
  return useContext(SessionContext);
}
