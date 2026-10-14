import { AUDIT_ACTION } from "../../shared/domain-enums";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";

/** A batch id may only be continued by its creator for this long (spec §5: one import = one file). */
const BATCH_TTL_SQL = "-2 hours";

export async function createImportBatch(
  d1: D1Database,
  userId: number,
  file: { name: string; totalRows: number; errorRows: number },
): Promise<number> {
  const res = await d1
    .prepare(
      `INSERT INTO import_batches (file_name, total_rows, imported_rows, error_rows, created_by)
       VALUES (?, ?, 0, ?, ?)`,
    )
    .bind(file.name, file.totalRows, file.errorRows, userId)
    .run();
  return res.meta.last_row_id;
}

/** 403 unless the batch exists, was created by `userId` and is younger than 2 hours. */
export async function assertBatchOwned(
  d1: D1Database,
  batchId: number,
  userId: number,
): Promise<void> {
  const row = await d1
    .prepare(
      `SELECT id FROM import_batches
       WHERE id = ? AND created_by = ? AND created_at >= datetime('now', ?)`,
    )
    .bind(batchId, userId, BATCH_TTL_SQL)
    .first<{ id: number }>();
  if (!row) throw AppError.forbidden("Đợt import không tồn tại hoặc đã hết hạn");
}

export interface LotSummary {
  batchId: number;
  userId: number;
  fileName: string;
  serverErrorRows: number;
  savedRowNumbers: readonly number[];
}

/** Statements appended to the lot's `db.batch`: refresh counters from the awards, then one IMPORT audit row. */
export function lotClosingStatements(d1: D1Database, s: LotSummary): D1PreparedStatement[] {
  const update = d1
    .prepare(
      `UPDATE import_batches
       SET imported_rows = (SELECT COUNT(*) FROM awards WHERE import_batch_id = ?),
           error_rows = error_rows + ?
       WHERE id = ?`,
    )
    .bind(s.batchId, s.serverErrorRows, s.batchId);
  const audit = auditStatement(d1, {
    userId: s.userId,
    action: AUDIT_ACTION.IMPORT,
    entity: "import_batch",
    entityId: s.batchId,
    detail: {
      file_name: s.fileName,
      saved_ids_count: s.savedRowNumbers.length,
      rows: s.savedRowNumbers,
    },
  });
  return [update, audit];
}
