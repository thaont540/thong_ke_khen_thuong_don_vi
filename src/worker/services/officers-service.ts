import { AUDIT_ACTION } from "../../shared/domain-enums";
import { normalizeText } from "../../shared/normalize-text";
import type { OfficerInput } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { sqlTimestamp } from "../lib/sql-timestamp";
import {
  INSERT_OFFICER_WITH_NEXT_CODE,
  isBadgeConflict,
  isCodeConflict,
} from "./officer-code-generator";
import { findActiveOfficer } from "./officer-record";
import { assertBadgeFree, assertOfficerRefs, badgeTakenError } from "./officers-validation";

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
  joined_month: string | null;
  rating_id: number | null;
}

const auditView = (o: OfficerInput | OfficerRow) => ({
  full_name: o.full_name,
  birth_year: o.birth_year,
  badge_number: o.badge_number,
  rank_id: o.rank_id,
  position_id: o.position_id,
  unit_id: o.unit_id,
  team_id: o.team_id,
  joined_month: o.joined_month,
  rating_id: o.rating_id,
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
        i.joined_month,
        i.rating_id,
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

const CODE_RETRIES = 5;

/** MAX+1 code collisions under concurrent creates are retried; badge conflicts map to 409. */
async function insertWithCodeRetry(d1: D1Database, actorId: number, i: OfficerInput) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insertOfficer(d1, actorId, i);
    } catch (err) {
      if (isBadgeConflict(err)) throw badgeTakenError();
      if (!isCodeConflict(err) || attempt >= CODE_RETRIES) throw err;
    }
  }
}

export async function createOfficer(d1: D1Database, actorId: number, input: OfficerInput) {
  await assertOfficerRefs(d1, input);
  await assertBadgeFree(d1, input.badge_number, null);
  const id = await insertWithCodeRetry(d1, actorId, input);
  return findActiveOfficer(d1, id);
}

export async function updateOfficer(
  d1: D1Database,
  actorId: number,
  id: number,
  input: OfficerInput,
) {
  const before = await findActiveOfficer(d1, id);
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
             rank_id = ?, position_id = ?, unit_id = ?, team_id = ?, joined_month = ?, rating_id = ?,
             updated_at = ?
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
          input.joined_month,
          input.rating_id,
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
  return findActiveOfficer(d1, id);
}

/** BR-05: soft-deletes the officer and, in the same batch, every active award of the officer. */
export async function deleteOfficer(
  d1: D1Database,
  actorId: number,
  id: number,
): Promise<{ deleted_awards: number }> {
  const before = await findActiveOfficer(d1, id);
  const now = sqlTimestamp();
  // meta.changes also counts the award_counters trigger writes, so the count is read in-batch.
  const results = await d1.batch([
    d1
      .prepare("SELECT COUNT(*) AS n FROM awards WHERE officer_id = ? AND deleted_at IS NULL")
      .bind(id),
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
  // Concurrent delete already won: the officer UPDATE matched nothing and no audit row was written.
  if (results[2]?.meta.changes === 0) throw AppError.notFound("Không tìm thấy cán bộ");
  return { deleted_awards: (results[0]?.results[0] as { n: number } | undefined)?.n ?? 0 };
}

export { listOfficers, type OfficerListQuery } from "./officers-list-service";
