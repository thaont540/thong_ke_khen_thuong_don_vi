/**
 * Single-statement INSERT that derives the next `CBnnn` code from MAX(code) over ALL rows
 * (soft-deleted included, so a code is never reused). Concurrent inserts are caught by
 * the UNIQUE(code) constraint; the caller retries once.
 */
export const INSERT_OFFICER_WITH_NEXT_CODE = `
  INSERT INTO officers (code, full_name, full_name_search, birth_year, badge_number,
                        rank_id, position_id, unit_id, team_id, created_by)
  SELECT 'CB' || printf('%03d', COALESCE(MAX(CAST(substr(code, 3) AS INTEGER)), 0) + 1),
         ?, ?, ?, ?, ?, ?, ?, ?, ?
  FROM officers`;

export const isCodeConflict = (err: unknown): boolean =>
  err instanceof Error && err.message.includes("officers.code");

export const isBadgeConflict = (err: unknown): boolean =>
  err instanceof Error && err.message.includes("officers.badge_number");
