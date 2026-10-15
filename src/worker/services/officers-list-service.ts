import type { OfficerListItem } from "../../shared/schemas/officer-schemas";
import { toPageParams } from "../lib/pagination";
import { LIKE_ESCAPE, toLikePattern } from "../lib/sql-like-pattern";
import {
  OFFICER_AWARD_COUNT as AWARD_COUNT,
  OFFICER_COLUMNS as COLUMNS,
  OFFICER_RATING_JOIN as RATING_JOIN,
} from "./officer-record";

export interface OfficerListQuery {
  unit_id?: number | undefined;
  team_id?: number | undefined;
  q?: string | undefined;
  page: number;
  size: number;
}

export async function listOfficers(d1: D1Database, q: OfficerListQuery) {
  const where = ["o.deleted_at IS NULL"];
  const binds: (string | number)[] = [];
  if (q.unit_id !== undefined) {
    where.push("o.unit_id = ?");
    binds.push(q.unit_id);
  }
  if (q.team_id !== undefined) {
    where.push("o.team_id = ?");
    binds.push(q.team_id);
  }
  const pattern = toLikePattern(q.q);
  if (pattern) {
    // Name: contains. Badge and code: prefix (BR-07 normalised, wildcards escaped).
    const prefix = pattern.slice(1);
    where.push(
      `(o.full_name_search LIKE ? ESCAPE '${LIKE_ESCAPE}'
        OR o.badge_number LIKE ? ESCAPE '${LIKE_ESCAPE}'
        OR o.code LIKE ? ESCAPE '${LIKE_ESCAPE}')`,
    );
    binds.push(pattern, prefix, prefix);
  }
  const { page, size, limit, offset } = toPageParams(q.page, q.size);
  const clause = where.join(" AND ");
  const [rows, total] = await Promise.all([
    d1
      .prepare(
        `SELECT ${COLUMNS}, ${AWARD_COUNT} AS award_count
         FROM officers o JOIN units u ON u.id = o.unit_id ${RATING_JOIN}
         WHERE ${clause}
         ORDER BY u.sort_order, o.full_name_search, o.id LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<OfficerListItem>(),
    d1
      .prepare(`SELECT COUNT(*) AS n FROM officers o WHERE ${clause}`)
      .bind(...binds)
      .first<{ n: number }>(),
  ]);
  return { items: rows.results, total: total?.n ?? 0, page, size };
}
