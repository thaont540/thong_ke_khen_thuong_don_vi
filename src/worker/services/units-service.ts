import { AUDIT_ACTION } from "../../shared/domain-enums";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import type { UnitDetail, UnitUpsert } from "../../shared/schemas/unit-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { getUnitDetail } from "./units-query-service";
import { MAX_BATCH_STATEMENTS, planTeamSync } from "./units-team-sync-service";
import { assertTeamNamesUnique, assertUnitFieldsUnique } from "./units-validation";

export { getUnitDetail, listUnits } from "./units-query-service";

const assertBatchSize = (n: number) => {
  if (n > MAX_BATCH_STATEMENTS) {
    throw AppError.validation("Quá nhiều thay đổi đội trong một lần lưu, hãy chia nhỏ");
  }
};

export async function createUnit(
  d1: D1Database,
  actorId: number,
  input: UnitUpsert,
): Promise<UnitDetail> {
  assertTeamNamesUnique(input.teams);
  await assertUnitFieldsUnique(d1, input, null);
  const plan = await planTeamSync(
    d1,
    {
      code: input.code,
      ref: { sql: "(SELECT id FROM units WHERE code = ?)", bind: input.code },
      existing: [],
    },
    input.teams,
  );
  assertBatchSize(plan.statements.length + 2);
  let results: D1Result[];
  try {
    results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO units (code, name, kind, description, sort_order)
           SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM units`,
        )
        .bind(input.code, input.name, input.kind, input.description),
      auditStatement(d1, {
        userId: actorId,
        action: AUDIT_ACTION.CREATE,
        entity: "unit",
        entityId: "LAST_INSERT",
        detail: { code: input.code, name: input.name, kind: input.kind, teams: plan.detail.added },
      }),
      ...plan.statements,
    ]);
  } catch (err) {
    throw uniqueToConflict(err);
  }
  const id = results[0]?.meta.last_row_id;
  if (!id) throw new Error("unit insert returned no row id");
  return getUnitDetail(d1, id);
}

export async function updateUnit(
  d1: D1Database,
  actorId: number,
  id: number,
  input: UnitUpsert,
): Promise<UnitDetail> {
  const before = await getUnitDetail(d1, id);
  assertTeamNamesUnique(input.teams);
  await assertUnitFieldsUnique(d1, input, id);
  const plan = await planTeamSync(
    d1,
    { code: input.code, ref: { sql: "?", bind: id }, existing: before.teams },
    input.teams,
  );
  assertBatchSize(plan.statements.length + 2);

  const fields = ["code", "name", "kind", "description"] as const;
  const changed = fields.filter((f) => before[f] !== input[f]);
  try {
    await d1.batch([
      d1
        .prepare(
          `UPDATE units SET code = ?, name = ?, kind = ?, description = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(input.code, input.name, input.kind, input.description, sqlTimestamp(), id),
      auditStatement(d1, {
        userId: actorId,
        action: AUDIT_ACTION.UPDATE,
        entity: "unit",
        entityId: id,
        detail: {
          before: Object.fromEntries(changed.map((f) => [f, before[f]])),
          after: Object.fromEntries(changed.map((f) => [f, input[f]])),
          teams: plan.detail,
        },
      }),
      ...plan.statements,
    ]);
  } catch (err) {
    throw uniqueToConflict(err);
  }
  return getUnitDetail(d1, id);
}

export async function deleteUnit(d1: D1Database, actorId: number, id: number): Promise<void> {
  const before = await getUnitDetail(d1, id);
  // Soft-deleted rows still reference the unit (FK), so they block too (clarification Q8).
  const used = await d1
    .prepare(
      `SELECT (SELECT COUNT(*) FROM officers WHERE unit_id = ?) AS officers,
              (SELECT COUNT(*) FROM awards WHERE unit_id = ?) AS awards`,
    )
    .bind(id, id)
    .first<{ officers: number; awards: number }>();
  if (used && used.officers + used.awards > 0) {
    throw new AppError(
      409,
      ERROR_CODE.CONFLICT,
      `Chưa thể xóa đơn vị: còn ${used.officers} cán bộ và ${used.awards} khen thưởng`,
      undefined,
      { officer_count: used.officers, award_count: used.awards },
    );
  }
  await d1.batch([
    d1.prepare("DELETE FROM units WHERE id = ?").bind(id),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.DELETE,
      entity: "unit",
      entityId: id,
      detail: { code: before.code, name: before.name, teams: before.teams.map((t) => t.name) },
      onlyIfPreviousChanged: true,
    }),
  ]);
}

/** DB UNIQUE is only a backstop for races; the app-level checks give field messages first. */
function uniqueToConflict(err: unknown): unknown {
  if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
    const m = err.message;
    if (m.includes("units.code"))
      return AppError.conflict("Mã đơn vị đã tồn tại", { code: "Mã đơn vị đã tồn tại" });
    if (m.includes("units.name"))
      return AppError.conflict("Tên đơn vị đã tồn tại", { name: "Tên đơn vị đã tồn tại" });
    return AppError.conflict("Tên hoặc mã đội bị trùng");
  }
  return err;
}
