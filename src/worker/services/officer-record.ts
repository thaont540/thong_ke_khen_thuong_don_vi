import type { CurrentRating, OfficerListItem } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";

/**
 * Current rating = latest-year non-deleted XEP_LOAI award of the officer (one row, served by the
 * partial index ix_awards_officer(officer_id, year DESC)); returned as JSON text, see `withCurrentRating`.
 */
const CURRENT_RATING_SQL = `(SELECT json_object('name', t.name, 'year', a.year)
   FROM awards a JOIN award_types t ON t.id = a.award_type_id
   WHERE a.officer_id = o.id AND a.deleted_at IS NULL AND t.form = 'XEP_LOAI'
   ORDER BY a.year DESC, a.id DESC LIMIT 1)`;

export const OFFICER_COLUMNS =
  "o.id, o.code, o.full_name, o.birth_year, o.badge_number, o.rank_id, o.position_id, o.unit_id, o.team_id, " +
  `o.joined_month, ${CURRENT_RATING_SQL} AS current_rating`;
export const OFFICER_AWARD_COUNT =
  "(SELECT COUNT(*) FROM awards a WHERE a.officer_id = o.id AND a.deleted_at IS NULL)";

/** Raw row of `OFFICER_COLUMNS`: `current_rating` is JSON text or NULL. */
export type RawOfficerRow<T> = Omit<T, "current_rating"> & { current_rating: string | null };

export function withCurrentRating<T>(row: RawOfficerRow<T>): T {
  const current_rating: CurrentRating | null = row.current_rating
    ? (JSON.parse(row.current_rating) as CurrentRating)
    : null;
  return { ...row, current_rating } as T;
}

export async function findActiveOfficer(d1: D1Database, id: number): Promise<OfficerListItem> {
  const row = await d1
    .prepare(
      `SELECT ${OFFICER_COLUMNS}, ${OFFICER_AWARD_COUNT} AS award_count FROM officers o
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(id)
    .first<RawOfficerRow<OfficerListItem>>();
  if (!row) throw AppError.notFound("Không tìm thấy cán bộ");
  return withCurrentRating(row);
}
