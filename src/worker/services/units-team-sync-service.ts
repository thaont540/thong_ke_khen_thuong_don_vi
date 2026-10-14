import { AppError } from "../lib/app-error";
import { sqlTimestamp } from "../lib/sql-timestamp";

export interface TeamInput {
  id?: number | undefined;
  name: string;
}
interface TeamRow {
  id: number;
  code: string;
  name: string;
}
/** How new teams reference their unit: numeric id (update) or lookup by code (unit inserted in the same batch). */
export interface UnitRef {
  sql: string;
  bind: string | number;
}

export interface TeamSyncPlan {
  statements: D1PreparedStatement[];
  detail: { added: string[]; renamed: { from: string; to: string }[]; removed: string[] };
}

/** Largest write batch we allow (D1 batches stay well below the platform cap). */
export const MAX_BATCH_STATEMENTS = 50;

const nextSuffix = (rows: readonly TeamRow[]): number =>
  rows.reduce((max, r) => {
    const m = /-T(\d+)$/i.exec(r.code);
    return m?.[1] ? Math.max(max, Number(m[1])) : max;
  }, 0) + 1;

/** Rows referencing a team, soft-deleted ones included (FK + clarification: they block deletion). */
async function teamUsage(d1: D1Database, teamId: number) {
  const row = await d1
    .prepare(
      `SELECT (SELECT COUNT(*) FROM officers WHERE team_id = ?) AS officers,
              (SELECT COUNT(*) FROM awards WHERE team_id = ?) AS awards`,
    )
    .bind(teamId, teamId)
    .first<{ officers: number; awards: number }>();
  return row ?? { officers: 0, awards: 0 };
}

/**
 * Diffs the submitted team list against the stored one: with id = rename (code kept),
 * without id = insert (`<unitCode>-T<n>`), stored but missing = delete (blocked while used).
 * Statement order is delete, rename, insert so freed names can be reused within one batch.
 */
export async function planTeamSync(
  d1: D1Database,
  unit: { code: string; ref: UnitRef; existing: readonly TeamRow[] },
  teams: readonly TeamInput[],
): Promise<TeamSyncPlan> {
  const byId = new Map(unit.existing.map((t) => [t.id, t]));
  const kept = new Set<number>();
  teams.forEach((t, i) => {
    if (t.id === undefined) return;
    if (!byId.has(t.id) || kept.has(t.id)) {
      throw AppError.validation("Đội không thuộc đơn vị này", {
        [`teams.${i}`]: "Đội không hợp lệ",
      });
    }
    kept.add(t.id);
  });

  const now = sqlTimestamp();
  const detail: TeamSyncPlan["detail"] = { added: [], renamed: [], removed: [] };
  const deletes: D1PreparedStatement[] = [];
  const renames: D1PreparedStatement[] = [];
  const inserts: D1PreparedStatement[] = [];

  for (const old of unit.existing) {
    if (kept.has(old.id)) continue;
    const used = await teamUsage(d1, old.id);
    if (used.officers + used.awards > 0) {
      throw AppError.conflict(
        `Không thể xóa ${old.name} vì còn ${used.officers} cán bộ và ${used.awards} khen thưởng thuộc đội này`,
      );
    }
    deletes.push(d1.prepare("DELETE FROM teams WHERE id = ?").bind(old.id));
    detail.removed.push(old.name);
  }

  let suffix = nextSuffix(unit.existing);
  let sort = unit.existing.length + 1;
  for (const t of teams) {
    const old = t.id === undefined ? undefined : byId.get(t.id);
    if (old) {
      if (old.name === t.name) continue;
      renames.push(
        d1
          .prepare("UPDATE teams SET name = ?, updated_at = ? WHERE id = ?")
          .bind(t.name, now, old.id),
      );
      detail.renamed.push({ from: old.name, to: t.name });
    } else {
      inserts.push(
        d1
          .prepare(
            `INSERT INTO teams (unit_id, code, name, sort_order) VALUES (${unit.ref.sql}, ?, ?, ?)`,
          )
          .bind(unit.ref.bind, `${unit.code}-T${suffix++}`, t.name, sort++),
      );
      detail.added.push(t.name);
    }
  }
  return { statements: [...deletes, ...renames, ...inserts], detail };
}
