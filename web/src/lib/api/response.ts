import { NextResponse } from "next/server";

/** 単一リソース／任意 JSON を返す。 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export type Pagination = { page: number; per_page: number; total: number };

/** 一覧レスポンス { data, pagination }（docs/API設計書.md）。 */
export function paginated<T>(data: T[], pagination: Pagination): NextResponse {
  return NextResponse.json({ data, pagination });
}
