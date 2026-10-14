import { normalizeText } from "../../shared/normalize-text";
import type { AwardListQuery } from "../../shared/schemas/list-query-schemas";
import { LIKE_ESCAPE, toLikePattern } from "../lib/sql-like-pattern";

export interface SqlFilter {
  /** Predicate list joined with AND by the caller; always includes the soft-delete guard. */
  where: string;
  binds: (string | number)[];
}

interface NamedRow {
  id: number;
  name: string;
}

/** Minimal catalog slice for matching collective names (BR-07 needs JS normalization, SQLite lower() is ASCII-only). */
export interface CollectiveNames {
  units: NamedRow[];
  teams: NamedRow[];
}

const likeCol = (col: string) => `${col} LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
const idList = (rows: NamedRow[], term: string) =>
  rows.filter((r) => normalizeText(r.name).includes(term)).map((r) => r.id);

/**
 * WHERE clause of F01 (alias `a` = awards, `t` = award_types).
 * `q` (BR-07) matches: decision number, officer name (personal), team name or - for unit-level
 * collective awards only - unit name. `names` is required whenever `q` is non-blank.
 */
export function buildAwardFilter(query: AwardListQuery, names?: CollectiveNames): SqlFilter {
  const parts = ["a.deleted_at IS NULL"];
  const binds: (string | number)[] = [];
  if (query.unit_id !== undefined) {
    parts.push("a.unit_id = ?");
    binds.push(query.unit_id);
  }
  if (query.team_id !== undefined) {
    parts.push("a.team_id = ?");
    binds.push(query.team_id);
  }
  if (query.subject) {
    parts.push("a.subject = ?");
    binds.push(query.subject);
  }
  if (query.form) {
    parts.push("t.form = ?");
    binds.push(query.form);
  }

  const pattern = toLikePattern(query.q);
  if (pattern !== null) {
    const term = normalizeText(query.q ?? "");
    const ors = [
      likeCol("a.decision_number_search"),
      `a.officer_id IN (SELECT id FROM officers WHERE ${likeCol("full_name_search")})`,
    ];
    binds.push(pattern, pattern);
    const teamIds = idList(names?.teams ?? [], term);
    if (teamIds.length > 0) {
      ors.push(`(a.subject = 'TAP_THE' AND a.team_id IN (SELECT value FROM json_each(?)))`);
      binds.push(JSON.stringify(teamIds)); // one bound param: D1 allows only 100 per statement
    }
    const unitIds = idList(names?.units ?? [], term);
    if (unitIds.length > 0) {
      ors.push(
        `(a.subject = 'TAP_THE' AND a.team_id IS NULL AND a.unit_id IN (SELECT value FROM json_each(?)))`,
      );
      binds.push(JSON.stringify(unitIds));
    }
    parts.push(`(${ors.join(" OR ")})`);
  }
  return { where: parts.join(" AND "), binds };
}
