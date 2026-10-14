import { AUDIT_ACTION } from "../../shared/domain-enums";
import { normalizeText } from "../../shared/normalize-text";
import type { AwardInput } from "../../shared/schemas/award-schemas";
import { auditStatement } from "../lib/audit-log-statement";
import type { DuplicateKey } from "./award-duplicate-check-service";

type Bind = string | number | null;

const COMMON_COLUMNS = `award_type_id, award_variant_id, year, decision_number, decision_number_search,
  decision_date, authority_id, achievement, note`;

export const commonBinds = (i: AwardInput): Bind[] => [
  i.award_type_id,
  i.award_variant_id,
  i.year,
  i.decision_number,
  normalizeText(i.decision_number),
  i.decision_date,
  i.authority_id,
  i.achievement,
  i.note,
];

export const auditDetail = (i: AwardInput) => {
  const { confirm_duplicate: _ignored, ...rest } = i;
  return rest;
};

/**
 * INSERT for one award (also used by F04 import, which passes `importBatchId`).
 * CA_NHAN copies unit/team from the officer row in the same statement (BR-02); no active officer =>
 * 0 rows changed. Must be followed by `auditStatement(..., entityId: "LAST_INSERT", onlyIfPreviousChanged)`.
 */
export function insertAwardStatement(
  d1: D1Database,
  userId: number,
  i: AwardInput,
  importBatchId: number | null = null,
): D1PreparedStatement {
  const tail = [importBatchId, userId];
  if (i.subject === "CA_NHAN") {
    return d1
      .prepare(
        `INSERT INTO awards (subject, officer_id, unit_id, team_id, ${COMMON_COLUMNS}, import_batch_id, created_by)
         SELECT 'CA_NHAN', o.id, o.unit_id, o.team_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM officers o WHERE o.id = ? AND o.deleted_at IS NULL`,
      )
      .bind(...commonBinds(i), ...tail, i.officer_id);
  }
  return d1
    .prepare(
      `INSERT INTO awards (subject, officer_id, unit_id, team_id, ${COMMON_COLUMNS}, import_batch_id, created_by)
       VALUES ('TAP_THE', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(i.unit_id, i.team_id, ...commonBinds(i), ...tail);
}

export const awardAuditInsert = (d1: D1Database, userId: number, i: AwardInput, via?: string) =>
  auditStatement(d1, {
    userId,
    action: AUDIT_ACTION.CREATE,
    entity: "award",
    entityId: "LAST_INSERT",
    detail: via ? { ...auditDetail(i), via } : auditDetail(i),
    onlyIfPreviousChanged: true,
  });

/** BR-08 key of an input. `excludeId` is the record being edited. */
export function duplicateKeyOf(i: AwardInput, excludeId?: number): DuplicateKey {
  return {
    subject: i.subject,
    officerId: i.subject === "CA_NHAN" ? i.officer_id : null,
    unitId: i.subject === "TAP_THE" ? i.unit_id : null,
    teamId: i.subject === "TAP_THE" ? i.team_id : null,
    awardTypeId: i.award_type_id,
    variantId: i.award_variant_id,
    year: i.year,
    excludeId,
  };
}
