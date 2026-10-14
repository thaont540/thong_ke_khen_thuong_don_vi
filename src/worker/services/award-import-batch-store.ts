import { AppError } from "../lib/app-error";

/** A batch id may only be continued by its creator for this long (spec §5: one import = one file). */
const BATCH_TTL_SQL = "-2 hours";

export async function createImportBatch(
  d1: D1Database,
  userId: number,
  file: {
    name: string;
    totalRows: number /** Browser-reported, informational; capped at totalRows. */;
    errorRows: number;
  },
): Promise<number> {
  const res = await d1
    .prepare(
      `INSERT INTO import_batches (file_name, total_rows, imported_rows, error_rows, created_by)
       VALUES (?, ?, 0, MIN(?, ?), ?)`,
    )
    .bind(file.name, file.totalRows, file.errorRows, file.totalRows, userId)
    .run();
  return res.meta.last_row_id;
}

export interface OwnedBatch {
  id: number;
  totalRows: number;
  importedRows: number;
}

/** 403 unless the batch exists, was created by `userId` and is younger than 2 hours. */
export async function assertBatchOwned(
  d1: D1Database,
  batchId: number,
  userId: number,
): Promise<OwnedBatch> {
  const row = await d1
    .prepare(
      `SELECT id, total_rows, imported_rows FROM import_batches
       WHERE id = ? AND created_by = ? AND created_at >= datetime('now', ?)`,
    )
    .bind(batchId, userId, BATCH_TTL_SQL)
    .first<{ id: number; total_rows: number; imported_rows: number }>();
  if (!row) throw AppError.forbidden("Đợt import không tồn tại hoặc đã hết hạn");
  return { id: row.id, totalRows: row.total_rows, importedRows: row.imported_rows };
}

/** Best-effort removal of a batch row created by a lot whose insert batch failed (no orphans). */
export async function discardEmptyBatch(d1: D1Database, batchId: number): Promise<void> {
  await d1
    .prepare(
      `DELETE FROM import_batches WHERE id = ? AND imported_rows = 0
         AND NOT EXISTS (SELECT 1 FROM awards WHERE import_batch_id = ?)`,
    )
    .bind(batchId, batchId)
    .run();
}

export interface LotSummary {
  batchId: number;
  userId: number;
  fileName: string;
  /** Rows of this lot the server rejected during validation. */
  serverErrorRows: number;
  /** Rows of this lot that were handed to INSERT (some may still be skipped, e.g. officer gone). */
  attemptedRows: number;
}

/**
 * Statements appended to the lot's `db.batch`, after the inserts. Everything derives from the rows
 * actually present in `awards`: the IMPORT audit row (skipped when nothing was saved) logs the real
 * saved count, then the counters are refreshed (error_rows also counts attempted-but-skipped rows
 * and never exceeds total_rows). The audit runs first because it reads the pre-update counter.
 */
export function lotClosingStatements(d1: D1Database, s: LotSummary): D1PreparedStatement[] {
  const savedNow = "(SELECT COUNT(*) FROM awards WHERE import_batch_id = ?)";
  const audit = d1
    .prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail)
       SELECT ?, 'IMPORT', 'import_batch', id,
              json_object('file_name', ?, 'saved_count', ${savedNow} - imported_rows,
                          'attempted_count', ?)
       FROM import_batches WHERE id = ? AND ${savedNow} > imported_rows`,
    )
    .bind(s.userId, s.fileName, s.batchId, s.attemptedRows, s.batchId, s.batchId);
  const update = d1
    .prepare(
      `UPDATE import_batches
       SET imported_rows = ${savedNow},
           error_rows = MIN(total_rows, error_rows + ? + (? - (${savedNow} - imported_rows)))
       WHERE id = ?`,
    )
    .bind(s.batchId, s.serverErrorRows, s.attemptedRows, s.batchId, s.batchId);
  return [audit, update];
}
