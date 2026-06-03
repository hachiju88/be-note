import { ApiError } from "./errors";

export type PageParams = {
  page: number;
  perPage: number;
  /** Supabase `.range()` 用（0 始まり・両端含む）。 */
  from: number;
  to: number;
};

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/** `?page=&per_page=` を解釈する（docs/API設計書.md「ページネーション」）。 */
export function parsePagination(searchParams: URLSearchParams): PageParams {
  const page = parsePositiveInt(searchParams.get("page"), 1, "page");
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("per_page"), DEFAULT_PER_PAGE, "per_page"),
    MAX_PER_PAGE,
  );
  const from = (page - 1) * perPage;
  return { page, perPage, from, to: from + perPage - 1 };
}

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  field: string,
): number {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(
      "INVALID_PARAMS",
      `${field} は 1 以上の整数で指定してください。`,
    );
  }
  return n;
}
