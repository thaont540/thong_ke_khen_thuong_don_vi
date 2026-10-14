import { normalizeText } from "../../shared/normalize-text";
import type { UnitDetail, UnitListItem } from "../../shared/schemas/unit-schemas";
import { AppError } from "../lib/app-error";

/** Active-row counts (soft-deleted officers/awards excluded) shown in F06. */
const UNIT_SELECT = `
  SELECT u.id, u.code, u.name, u.kind, u.description,
    (SELECT COUNT(*) FROM teams t WHERE t.unit_id = u.id) AS team_count,
    (SELECT COUNT(*) FROM officers o WHERE o.unit_id = u.id AND o.deleted_at IS NULL) AS officer_count,
    (SELECT COUNT(*) FROM awards a WHERE a.unit_id = u.id AND a.deleted_at IS NULL) AS award_count
  FROM units u`;

/** Units are a handful of rows: search and paging run in JS so Vietnamese diacritics/case match (BR-07). */
export async function listUnits(
  d1: D1Database,
  q: { q?: string | undefined; page: number; size: number },
) {
  const { results } = await d1
    .prepare(`${UNIT_SELECT} ORDER BY u.sort_order, u.id`)
    .all<UnitListItem>();
  const term = normalizeText(q.q ?? "");
  const matched = term
    ? results.filter(
        (u) => normalizeText(u.name).includes(term) || normalizeText(u.code).includes(term),
      )
    : results;
  const start = (q.page - 1) * q.size;
  return {
    items: matched.slice(start, start + q.size),
    total: matched.length,
    page: q.page,
    size: q.size,
  };
}

export async function getUnitDetail(d1: D1Database, id: number): Promise<UnitDetail> {
  const unit = await d1.prepare(`${UNIT_SELECT} WHERE u.id = ?`).bind(id).first<UnitListItem>();
  if (!unit) throw AppError.notFound("Không tìm thấy đơn vị");
  const { results: teams } = await d1
    .prepare(
      `SELECT t.id, t.code, t.name,
         (SELECT COUNT(*) FROM officers o WHERE o.team_id = t.id AND o.deleted_at IS NULL) AS officer_count,
         (SELECT COUNT(*) FROM awards a WHERE a.team_id = t.id AND a.deleted_at IS NULL) AS award_count
       FROM teams t WHERE t.unit_id = ? ORDER BY t.sort_order, t.id`,
    )
    .bind(id)
    .all<UnitDetail["teams"][number]>();
  return { ...unit, teams };
}
