import type { OfficerListItem } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";

export const OFFICER_COLUMNS =
  "o.id, o.code, o.full_name, o.birth_year, o.badge_number, o.rank_id, o.position_id, o.unit_id, o.team_id, " +
  "o.joined_month, o.rating_id, r.name AS rating_name";
export const OFFICER_RATING_JOIN = "LEFT JOIN officer_ratings r ON r.id = o.rating_id";
export const OFFICER_AWARD_COUNT =
  "(SELECT COUNT(*) FROM awards a WHERE a.officer_id = o.id AND a.deleted_at IS NULL)";

export async function findActiveOfficer(d1: D1Database, id: number): Promise<OfficerListItem> {
  const row = await d1
    .prepare(
      `SELECT ${OFFICER_COLUMNS}, ${OFFICER_AWARD_COUNT} AS award_count FROM officers o ${OFFICER_RATING_JOIN}
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(id)
    .first<OfficerListItem>();
  if (!row) throw AppError.notFound("Không tìm thấy cán bộ");
  return row;
}
