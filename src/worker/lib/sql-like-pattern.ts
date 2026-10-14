import { normalizeText } from "../../shared/normalize-text";

export const LIKE_ESCAPE = "\\";
export const MAX_SEARCH_LENGTH = 50;

/**
 * Builds a `%term%` pattern for `col LIKE ? ESCAPE '\'`.
 * Input is normalized (BR-07), truncated to 50 chars, and `\ % _` are escaped.
 * Returns null for blank input (caller skips the predicate).
 */
export function toLikePattern(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const term = normalizeText(raw).slice(0, MAX_SEARCH_LENGTH);
  if (term === "") return null;
  return `%${term.replace(/[\\%_]/g, (ch) => `${LIKE_ESCAPE}${ch}`)}%`;
}
