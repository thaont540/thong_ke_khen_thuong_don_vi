import type { Subject } from "../../shared/domain-enums";
import type { AwardDuplicate } from "../../shared/schemas/award-schemas";

/** What BR-08 compares: same subject target (officer, or unit + team/NULL), type + variant, year. */
export interface DuplicateKey {
  subject: Subject;
  officerId: number | null;
  unitId: number | null;
  teamId: number | null;
  awardTypeId: number;
  variantId: number | null;
  year: number;
  /** Record being edited (never a duplicate of itself). */
  excludeId?: number | undefined;
}

const SELECT_DUP = `SELECT a.id, a.decision_number, a.year, COALESCE(v.name, t.name) AS type_name
  FROM awards a
  JOIN award_types t ON t.id = a.award_type_id
  LEFT JOIN award_variants v ON v.id = a.award_variant_id
  WHERE a.deleted_at IS NULL AND a.year = ? AND a.award_type_id = ? AND a.award_variant_id IS ?`;

/**
 * Prepared BR-08 lookup. Personal rows use ix_awards_officer (officer_id, year), collective rows
 * use ix_awards_unit_team (unit_id, team_id, year); `IS ?` makes NULL team / variant compare equal.
 */
export function duplicateStatement(d1: D1Database, k: DuplicateKey): D1PreparedStatement {
  const exclude = k.excludeId === undefined ? "" : " AND a.id <> ?";
  const tail = `${exclude} ORDER BY a.year DESC, a.id DESC LIMIT 20`;
  const base: (number | null)[] = [k.year, k.awardTypeId, k.variantId];
  if (k.subject === "CA_NHAN") {
    const binds = [...base, k.officerId];
    if (k.excludeId !== undefined) binds.push(k.excludeId);
    return d1.prepare(`${SELECT_DUP} AND a.officer_id = ?${tail}`).bind(...binds);
  }
  const binds = [...base, k.unitId, k.teamId];
  if (k.excludeId !== undefined) binds.push(k.excludeId);
  return d1
    .prepare(`${SELECT_DUP} AND a.subject = 'TAP_THE' AND a.unit_id = ? AND a.team_id IS ?${tail}`)
    .bind(...binds);
}

export async function findDuplicates(d1: D1Database, key: DuplicateKey): Promise<AwardDuplicate[]> {
  const { results } = await duplicateStatement(d1, key).all<AwardDuplicate>();
  return results;
}

/** One D1 round trip for many keys (F04 import: <= 30 rows); result[i] belongs to keys[i]. */
export async function findDuplicatesBulk(
  d1: D1Database,
  keys: readonly DuplicateKey[],
): Promise<AwardDuplicate[][]> {
  if (keys.length === 0) return [];
  const res = await d1.batch<AwardDuplicate>(keys.map((k) => duplicateStatement(d1, k)));
  return res.map((r) => r.results);
}
