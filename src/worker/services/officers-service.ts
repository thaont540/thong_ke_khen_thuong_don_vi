import { AUDIT_ACTION } from "../../shared/domain-enums";
import { normalizeText } from "../../shared/normalize-text";
import type { OfficerInput, OfficerListItem } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { toPageParams } from "../lib/pagination";
import { LIKE_ESCAPE, toLikePattern } from "../lib/sql-like-pattern";
import { sqlTimestamp } from "../lib/sql-timestamp";
import {
  INSERT_OFFICER_WITH_NEXT_CODE,
  isBadgeConflict,
  isCodeConflict,
} from "./officer-code-generator";
import { assertBadgeFree, assertOfficerRefs, badgeTakenError } from "./officers-validation";

const COLUMNS =
  "o.id, o.code, o.full_name, o.birth_year, o.badge_number, o.rank_id, o.position_id, o.unit_id, o.team_id";
const AWARD_COUNT =
  "(SELECT COUNT(*) FROM awards a WHERE a.officer_id = o.id AND a.deleted_at IS NULL)";

interface OfficerRow {
  id: number;
  code: string;
  full_name: string;
  birth_year: number;
  badge_number: string;
  rank_id: number;
  position_id: number;
  unit_id: number;
  team_id: number | null;
}

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
         FROM officers o JOIN units u ON u.id = o.unit_id
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

async function findActive(d1: D1Database, id: number): Promise<OfficerListItem> {
  const row = await d1
    .prepare(
      `SELECT ${COLUMNS}, ${AWARD_COUNT} AS award_count FROM officers o
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(id)
    .first<OfficerListItem>();
  if (!row) throw AppError.notFound("Không tìm thấy cán bộ");
  return row;
}

const auditView = (o: OfficerInput | OfficerRow) => ({
  full_name: o.full_name,
  birth_year: o.birth_year,
  badge_number: o.badge_number,
  rank_id: o.rank_id,
  position_id: o.position_id,
  unit_id: o.unit_id,
  team_id: o.team_id,
});

async function insertOfficer(d1: D1Database, actorId: number, i: OfficerInput): Promise<number> {
  const results = await d1.batch([
    d1
      .prepare(INSERT_OFFICER_WITH_NEXT_CODE)
      .bind(
        i.full_name,
        normalizeText(i.full_name),
        i.birth_year,
        i.badge_number,
        i.rank_id,
        i.position_id,
        i.unit_id,
        i.team_id,
        actorId,
      ),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.CREATE,
      entity: "officer",
      entityId: "LAST_INSERT",
      detail: { after: auditView(i) },
    }),
  ]);
  const id = results[0]?.meta.last_row_id;
  if (!id) throw new Error("officer insert returned no row id");
  return id;
}

export async function createOfficer(d1: D1Database, actorId: number, input: OfficerInput) {
  await assertOfficerRefs(d1, input);
  await assertBadgeFree(d1, input.badge_number, null);
  let id: number;
  try {
    id = await insertOfficer(d1, actorId, input);
  } catch (err) {
    if (isBadgeConflict(err)) throw badgeTakenError();
    if (!isCodeConflict(err)) throw err;
    id = await insertOfficer(d1, actorId, input); // lost the code race once: retry
  }
  return findActive(d1, id);
}

export async function updateOfficer(
  d1: D1Database,
  actorId: number,
  id: number,
  input: OfficerInput,
) {
  const before = await findActive(d1, id);
  await assertOfficerRefs(d1, input);
  await assertBadgeFree(d1, input.badge_number, id);
  const b = auditView(before);
  const a = auditView(input);
  const keys = (Object.keys(a) as (keyof typeof a)[]).filter((k) => a[k] !== b[k]);
  try {
    await d1.batch([
      // Existing awards keep their own unit/team snapshot (BR-02): awards are not touched here.
      d1
        .prepare(
          `UPDATE officers SET full_name = ?, full_name_search = ?, birth_year = ?, badge_number = ?,
             rank_id = ?, position_id = ?, unit_id = ?, team_id = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .bind(
          input.full_name,
          normalizeText(input.full_name),
          input.birth_year,
          input.badge_number,
          input.rank_id,
          input.position_id,
          input.unit_id,
          input.team_id,
          sqlTimestamp(),
          id,
        ),
      auditStatement(d1, {
        userId: actorId,
        action: AUDIT_ACTION.UPDATE,
        entity: "officer",
        entityId: id,
        detail: {
          before: Object.fromEntries(keys.map((k) => [k, b[k]])),
          after: Object.fromEntries(keys.map((k) => [k, a[k]])),
        },
        onlyIfPreviousChanged: true,
      }),
    ]);
  } catch (err) {
    throw isBadgeConflict(err) ? badgeTakenError() : err;
  }
  return findActive(d1, id);
}

/** BR-05: soft-deletes the officer and, in the same batch, every active award of the officer. */
export async function deleteOfficer(
  d1: D1Database,
  actorId: number,
  id: number,
): Promise<{ deleted_awards: number }> {
  const before = await findActive(d1, id);
  const now = sqlTimestamp();
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE awards SET deleted_at = ?, updated_at = ? WHERE officer_id = ? AND deleted_at IS NULL`,
      )
      .bind(now, now, id),
    d1
      .prepare(
        "UPDATE officers SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
      .bind(now, now, id),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.DELETE,
      entity: "officer",
      entityId: id,
      detail: { code: before.code, ...auditView(before), deleted_awards: before.award_count },
      onlyIfPreviousChanged: true,
    }),
  ]);
  return { deleted_awards: results[0]?.meta.changes ?? 0 };
}
