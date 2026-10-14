import { AUDIT_ACTION } from "../../shared/domain-enums";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import type { AwardInput } from "../../shared/schemas/award-schemas";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { duplicateStatement } from "./award-duplicate-check-service";
import { assertValidAward } from "./award-validation-service";
import {
  auditDetail,
  awardAuditInsert,
  commonBinds,
  duplicateKeyOf,
  insertAwardStatement,
} from "./award-write-statements";

/** Editable columns of an award as stored (audit before/after + BR-02 comparison). */
interface AwardRow {
  id: number;
  subject: "TAP_THE" | "CA_NHAN";
  officer_id: number | null;
  unit_id: number;
  team_id: number | null;
  award_type_id: number;
  award_variant_id: number | null;
  year: number;
  decision_number: string;
  decision_date: string;
  authority_id: number;
  achievement: string;
  note: string | null;
  updated_at: string;
}

const ROW_COLUMNS = `id, subject, officer_id, unit_id, team_id, award_type_id, award_variant_id,
  year, decision_number, decision_date, authority_id, achievement, note, updated_at`;

async function findActiveAward(d1: D1Database, id: number): Promise<AwardRow> {
  const row = await d1
    .prepare(`SELECT ${ROW_COLUMNS} FROM awards WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<AwardRow>();
  if (!row) throw AppError.notFound("Không tìm thấy bản ghi khen thưởng");
  return row;
}

/** Throws 409 DUPLICATE (with the list) unless the caller already confirmed (BR-08). */
async function guardDuplicates(d1: D1Database, i: AwardInput, excludeId?: number) {
  if (i.confirm_duplicate) return;
  const { results } = await duplicateStatement(d1, duplicateKeyOf(i, excludeId)).all<{
    id: number;
    decision_number: string;
    year: number;
    type_name: string;
  }>();
  if (results.length > 0) {
    throw new AppError(409, ERROR_CODE.DUPLICATE, "Có thể bị trùng với bản ghi đã có", undefined, {
      duplicates: results,
    });
  }
}

const officerNotFound = () =>
  new AppError(422, ERROR_CODE.CONSTRAINT, "Cán bộ không tồn tại hoặc đã bị xóa", {
    officer_id: "Cán bộ không tồn tại hoặc đã bị xóa",
  });

const staleRecord = () => AppError.conflict("Bản ghi đã được người khác sửa, vui lòng tải lại");

export async function createAward(
  d1: D1Database,
  master: MasterDataDto,
  userId: number,
  input: AwardInput,
): Promise<{ id: number }> {
  assertValidAward(master, input);
  await guardDuplicates(d1, input);
  const [insert] = await d1.batch([
    insertAwardStatement(d1, userId, input),
    awardAuditInsert(d1, userId, input),
  ]);
  if (!insert || insert.meta.changes === 0) throw officerNotFound();
  return { id: insert.meta.last_row_id };
}

export async function updateAward(
  d1: D1Database,
  master: MasterDataDto,
  userId: number,
  id: number,
  input: AwardInput,
): Promise<{ id: number }> {
  assertValidAward(master, input);
  const before = await findActiveAward(d1, id);
  if (input.updated_at !== undefined && input.updated_at !== before.updated_at) throw staleRecord();
  await guardDuplicates(d1, input, id);

  // BR-02: same officer keeps the stored unit/team; another officer takes their current unit/team.
  let unitId: number;
  let teamId: number | null;
  if (input.subject === "TAP_THE") {
    ({ unit_id: unitId, team_id: teamId } = input);
  } else if (before.subject === "CA_NHAN" && before.officer_id === input.officer_id) {
    ({ unit_id: unitId, team_id: teamId } = before);
  } else {
    const officer = await d1
      .prepare("SELECT unit_id, team_id FROM officers WHERE id = ? AND deleted_at IS NULL")
      .bind(input.officer_id)
      .first<{ unit_id: number; team_id: number | null }>();
    if (!officer) throw officerNotFound();
    ({ unit_id: unitId, team_id: teamId } = officer);
  }

  const after = {
    ...auditDetail(input),
    officer_id: input.subject === "CA_NHAN" ? input.officer_id : null,
    unit_id: unitId,
    team_id: teamId,
  };
  const [update] = await d1.batch([
    d1
      .prepare(
        `UPDATE awards SET subject = ?, officer_id = ?, unit_id = ?, team_id = ?,
           award_type_id = ?, award_variant_id = ?, year = ?, decision_number = ?,
           decision_number_search = ?, decision_date = ?, authority_id = ?, achievement = ?,
           note = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE id = ? AND deleted_at IS NULL AND updated_at = ?
           AND (? IS NULL OR EXISTS (SELECT 1 FROM officers WHERE id = ? AND deleted_at IS NULL))`,
      )
      .bind(
        input.subject,
        after.officer_id,
        unitId,
        teamId,
        ...commonBinds(input),
        id,
        before.updated_at,
        after.officer_id,
        after.officer_id,
      ),
    auditStatement(d1, {
      userId,
      action: AUDIT_ACTION.UPDATE,
      entity: "award",
      entityId: id,
      detail: { before: auditBefore(before), after },
      onlyIfPreviousChanged: true,
    }),
  ]);
  if (!update || update.meta.changes === 0) {
    // Lost the race: deleted, officer deleted, or edited by someone else since the read above.
    await findActiveAward(d1, id); // 404 when it was deleted meanwhile
    if (after.officer_id !== null) {
      const officer = await d1
        .prepare("SELECT 1 AS ok FROM officers WHERE id = ? AND deleted_at IS NULL")
        .bind(after.officer_id)
        .first();
      if (!officer) throw officerNotFound();
    }
    throw staleRecord();
  }
  return { id };
}

/** Audit `before` is the stored row without the concurrency token. */
function auditBefore({ updated_at: _token, ...row }: AwardRow) {
  return row;
}

export async function deleteAward(d1: D1Database, userId: number, id: number): Promise<void> {
  const before = await findActiveAward(d1, id);
  const [del] = await d1.batch([
    d1
      .prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL")
      .bind(id),
    auditStatement(d1, {
      userId,
      action: AUDIT_ACTION.DELETE,
      entity: "award",
      entityId: id,
      detail: { before: auditBefore(before) },
      onlyIfPreviousChanged: true,
    }),
  ]);
  if (!del || del.meta.changes === 0) throw AppError.notFound("Không tìm thấy bản ghi khen thưởng");
}
