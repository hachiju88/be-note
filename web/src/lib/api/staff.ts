import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";

/** staff_id → staff_name のマップをまとめて引く（N+1 回避）。 */
export async function fetchStaffNames(
  svc: SupabaseClient,
  staffIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(staffIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const { data, error } = await svc
    .from("t_staff")
    .select("staff_id, staff_name")
    .in("staff_id", unique);
  if (error) throw new ApiError("INTERNAL_ERROR", "スタッフ情報の取得に失敗しました。");
  return new Map((data ?? []).map((s) => [s.staff_id, s.staff_name]));
}

/** staff_id から { staff_id, staff_name } を作る（名前は names マップ参照）。 */
export function staffRef(
  staffId: string,
  names: Map<string, string>,
): { staff_id: string; staff_name: string | null } {
  return { staff_id: staffId, staff_name: names.get(staffId) ?? null };
}
