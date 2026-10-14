import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../shared/schemas/list-query-schemas";

export interface PageParams {
  page: number;
  size: number;
  limit: number;
  offset: number;
}

/** Clamps page >= 1 and 1 <= size <= 50 (default 10); returns SQL LIMIT/OFFSET. */
export function toPageParams(page?: number, size?: number): PageParams {
  const p = Number.isFinite(page) && page !== undefined ? Math.max(1, Math.trunc(page)) : 1;
  const s =
    Number.isFinite(size) && size !== undefined
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(size)))
      : DEFAULT_PAGE_SIZE;
  return { page: p, size: s, limit: s, offset: (p - 1) * s };
}
