import { AUDIT_ACTION } from "../../shared/domain-enums";
import type { NewOfficerDraft } from "../../shared/import/import-pending-officers";
import { normalizeText } from "../../shared/normalize-text";
import type { AwardInput } from "../../shared/schemas/award-schemas";
import { auditStatement } from "../lib/audit-log-statement";
import { COMMON_COLUMNS, commonBinds, insertAwardStatement } from "./award-write-statements";
import { INSERT_OFFICER_WITH_NEXT_CODE } from "./officer-code-generator";

/** Statements per new officer in a lot batch: the INSERT and its CREATE audit row. */
export const STATEMENTS_PER_NEW_OFFICER = 2;

/** INSERT (next free code, no birth year / badge) + CREATE audit row marked as coming from import. */
export function newOfficerStatements(
  d1: D1Database,
  userId: number,
  o: NewOfficerDraft,
): D1PreparedStatement[] {
  return [
    d1
      .prepare(INSERT_OFFICER_WITH_NEXT_CODE)
      .bind(
        o.full_name,
        normalizeText(o.full_name),
        null,
        null,
        o.rank_id,
        o.position_id,
        o.unit_id,
        o.team_id,
        null,
        userId,
      ),
    auditStatement(d1, {
      userId,
      action: AUDIT_ACTION.CREATE,
      entity: "officer",
      entityId: "LAST_INSERT",
      detail: {
        via: "import",
        after: {
          full_name: o.full_name,
          birth_year: null,
          badge_number: null,
          rank_id: o.rank_id,
          position_id: o.position_id,
          unit_id: o.unit_id,
          team_id: o.team_id,
          joined_month: null,
        },
      },
    }),
  ];
}

/**
 * Award INSERT of one import row. An existing officer is referenced by id; an officer created
 * earlier in the same `db.batch` is found by its natural key (name + unit + team), newest first.
 * Either way unit/team are copied from the officer row (BR-02) and no active officer => 0 changes.
 */
export function importAwardStatement(
  d1: D1Database,
  userId: number,
  input: AwardInput,
  batchId: number,
  drafts: ReadonlyMap<number, NewOfficerDraft>,
): D1PreparedStatement {
  const draft = input.subject === "CA_NHAN" ? drafts.get(input.officer_id) : undefined;
  if (!draft) return insertAwardStatement(d1, userId, input, batchId);
  return d1
    .prepare(
      `INSERT INTO awards (subject, officer_id, unit_id, team_id, ${COMMON_COLUMNS}, import_batch_id, created_by)
       SELECT 'CA_NHAN', o.id, o.unit_id, o.team_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM officers o WHERE o.id = (
         SELECT id FROM officers WHERE full_name_search = ? AND unit_id = ? AND team_id IS ?
           AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)`,
    )
    .bind(
      ...commonBinds(input),
      batchId,
      userId,
      normalizeText(draft.full_name),
      draft.unit_id,
      draft.team_id,
    );
}
