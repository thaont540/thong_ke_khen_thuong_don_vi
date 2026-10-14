import type { OfficerDetail, OfficerOption } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";
import {
  AWARD_ORDER,
  AWARD_RECORD_COLUMNS,
  AWARD_RECORD_JOINS,
  toAwardRecord,
} from "./award-record-sql";

const OPTIONS_CAP = 5000;

/** GET /api/officers/options: active officers, compact; client caches and narrows by unit/team. */
export async function listOfficerOptions(
  d1: D1Database,
  filter: { unit_id?: number | undefined; team_id?: number | undefined },
): Promise<{ items: OfficerOption[] }> {
  const parts = ["deleted_at IS NULL"];
  const binds: number[] = [];
  if (filter.unit_id !== undefined) {
    parts.push("unit_id = ?");
    binds.push(filter.unit_id);
  }
  if (filter.team_id !== undefined) {
    parts.push("team_id = ?");
    binds.push(filter.team_id);
  }
  const { results } = await d1
    .prepare(
      `SELECT id, code, full_name, rank_id, badge_number, unit_id, team_id FROM officers
       WHERE ${parts.join(" AND ")} ORDER BY full_name_search, id LIMIT ?`,
    )
    .bind(...binds, OPTIONS_CAP)
    .all<OfficerOption>();
  return { items: results };
}

/** GET /api/officers/:id (F02): officer + active awards, year desc. */
export async function getOfficerDetail(d1: D1Database, id: number): Promise<OfficerDetail> {
  const [officer, awards] = await d1.batch([
    d1
      .prepare(
        `SELECT id, code, full_name, birth_year, badge_number, rank_id, position_id, unit_id, team_id
         FROM officers WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(id),
    d1
      .prepare(
        `SELECT ${AWARD_RECORD_COLUMNS} ${AWARD_RECORD_JOINS}
         WHERE a.officer_id = ? AND a.deleted_at IS NULL ${AWARD_ORDER}`,
      )
      .bind(id),
  ]);
  const row = officer?.results[0] as Omit<OfficerDetail, "awards"> | undefined;
  if (!row) throw AppError.notFound("Không tìm thấy cán bộ");
  return { ...row, awards: (awards?.results ?? []).map(toAwardRecord) };
}
