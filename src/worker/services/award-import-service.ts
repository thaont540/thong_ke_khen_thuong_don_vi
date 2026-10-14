import type {
  ImportRequest,
  ImportResponse,
  ImportRowResult,
} from "../../shared/schemas/award-import-schemas";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";
import {
  assertBatchOwned,
  createImportBatch,
  lotClosingStatements,
} from "./award-import-batch-store";
import { type CheckedRow, checkImportLot } from "./award-import-lot-checker";
import { insertAwardStatement } from "./award-write-statements";

const OFFICER_GONE = "Cán bộ không tồn tại hoặc đã bị xóa";

function baseResult(c: CheckedRow): ImportRowResult {
  const dup = c.check.input !== null && c.duplicateMessages.length > 0;
  return {
    row_number: c.row.row_number,
    status: c.check.errors.length > 0 ? "ERROR" : dup ? "DUPLICATE" : "OK",
    errors: c.check.errors,
    duplicate_messages: c.duplicateMessages,
    imported: false,
  };
}

/**
 * POST /api/awards/import: one lot of <= 30 rows. Re-validates every row (BR-07/BR-08, spec §2),
 * and unless `dry_run` saves OK rows (plus DUPLICATE rows when `include_duplicates`) in one atomic
 * `db.batch` together with the import_batches counters and one IMPORT audit row.
 */
export async function importAwardsLot(
  d1: D1Database,
  master: MasterDataDto,
  userId: number,
  req: ImportRequest,
): Promise<ImportResponse> {
  if (!req.dry_run && req.batch_id !== undefined) await assertBatchOwned(d1, req.batch_id, userId);

  const checked = await checkImportLot(d1, master, req.rows);
  const results = checked.map(baseResult);
  const savable = checked.filter((c, i) => {
    const status = results[i]?.status;
    return c.check.input && (status === "OK" || (status === "DUPLICATE" && req.include_duplicates));
  });

  if (req.dry_run || savable.length === 0) {
    return { batch_id: req.dry_run ? null : (req.batch_id ?? null), imported_count: 0, results };
  }

  const batchId =
    req.batch_id ??
    (await createImportBatch(d1, userId, {
      name: req.file_name,
      totalRows: req.total_rows,
      errorRows: req.client_error_rows,
    }));
  const inserts = savable.map((c) =>
    insertAwardStatement(d1, userId, c.check.input as NonNullable<typeof c.check.input>, batchId),
  );
  const serverErrorRows = results.filter((r) => r.status === "ERROR").length;
  const outcomes = await d1.batch([
    ...inserts,
    ...lotClosingStatements(d1, {
      batchId,
      userId,
      fileName: req.file_name,
      serverErrorRows,
      savedRowNumbers: savable.map((c) => c.row.row_number),
    }),
  ]);

  let imported = 0;
  savable.forEach((c, n) => {
    const res = results.find((r) => r.row_number === c.row.row_number);
    const outcome = outcomes[n];
    if (!res) return;
    if (outcome && outcome.meta.changes > 0) {
      res.imported = true;
      res.award_id = outcome.meta.last_row_id;
      imported += 1;
    } else {
      res.status = "ERROR";
      res.errors = [OFFICER_GONE];
    }
  });
  return { batch_id: batchId, imported_count: imported, results };
}
