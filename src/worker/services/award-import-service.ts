import type { NewOfficerDraft } from "../../shared/import/import-pending-officers";
import type {
  ImportRequest,
  ImportResponse,
  ImportRowResult,
} from "../../shared/schemas/award-import-schemas";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";
import { AppError } from "../lib/app-error";
import {
  assertBatchOwned,
  createImportBatch,
  discardEmptyBatch,
  lotClosingStatements,
  type OwnedBatch,
} from "./award-import-batch-store";
import { type CheckedRow, checkImportLot } from "./award-import-lot-checker";
import {
  importAwardStatement,
  newOfficerStatements,
  STATEMENTS_PER_NEW_OFFICER,
} from "./award-import-officer-statements";
import { isCodeConflict } from "./officer-code-generator";

const OFFICER_GONE = "Cán bộ không tồn tại hoặc đã bị xóa";

function baseResult(c: CheckedRow): ImportRowResult {
  const dup = c.check.input !== null && c.duplicateMessages.length > 0;
  return {
    row_number: c.row.row_number,
    status: c.check.errors.length > 0 ? "ERROR" : dup ? "DUPLICATE" : "OK",
    errors: c.check.errors,
    duplicate_messages: c.duplicateMessages,
    imported: false,
    ...(c.check.newOfficer ? { new_officer: true } : {}),
  };
}

const CODE_RETRIES = 5;
const RATING_RACE = "Cán bộ đã có xếp loại năm này";

/** The lot's atomic batch; officer code collisions (MAX+1 under concurrency) are retried, the batch having rolled back. */
async function runLotBatch(d1: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await d1.batch(statements);
    } catch (err) {
      if (err instanceof Error && err.message.includes(RATING_RACE)) {
        throw AppError.constraint(RATING_RACE);
      }
      if (!isCodeConflict(err) || attempt >= CODE_RETRIES) throw err;
    }
  }
}

/**
 * POST /api/awards/import: one lot of <= 30 rows. Re-validates every row (BR-07/BR-08, spec §2),
 * and unless `dry_run` saves OK rows (plus DUPLICATE rows when `include_duplicates`) in one atomic
 * `db.batch` together with the import_batches counters and one IMPORT audit row. Officers that do
 * not exist yet (Cá nhân rows) are created in that same batch, before the awards that use them.
 */
export async function importAwardsLot(
  d1: D1Database,
  master: MasterDataDto,
  userId: number,
  req: ImportRequest,
): Promise<ImportResponse> {
  // Declared size and progress of an existing batch are authoritative; the request's total_rows is
  // only used when the first lot creates the batch.
  const existing: OwnedBatch | null =
    !req.dry_run && req.batch_id !== undefined
      ? await assertBatchOwned(d1, req.batch_id, userId)
      : null;

  const checked = await checkImportLot(d1, master, req.rows);
  const results = checked.map(baseResult);
  const savable = checked.filter((c, i) => {
    const status = results[i]?.status;
    return c.check.input && (status === "OK" || (status === "DUPLICATE" && req.include_duplicates));
  });

  if (req.dry_run || savable.length === 0) {
    return { batch_id: req.dry_run ? null : (req.batch_id ?? null), imported_count: 0, results };
  }

  const capacity = (existing?.totalRows ?? req.total_rows) - (existing?.importedRows ?? 0);
  if (savable.length > capacity) {
    throw AppError.constraint("Vượt quá số dòng đã khai báo của đợt import");
  }

  const createdBatchId = existing
    ? null
    : await createImportBatch(d1, userId, {
        name: req.file_name,
        totalRows: req.total_rows,
        errorRows: req.client_error_rows,
      });
  const batchId = existing?.id ?? (createdBatchId as number);
  const drafts = new Map<number, NewOfficerDraft>();
  for (const c of savable)
    if (c.check.newOfficer) drafts.set(c.check.newOfficer.temp_id, c.check.newOfficer);
  const officerStatements = [...drafts.values()].flatMap((o) =>
    newOfficerStatements(d1, userId, o),
  );
  const inserts = savable.map((c) =>
    importAwardStatement(
      d1,
      userId,
      c.check.input as NonNullable<typeof c.check.input>,
      batchId,
      drafts,
    ),
  );
  const serverErrorRows = results.filter((r) => r.status === "ERROR").length;
  let outcomes: D1Result[];
  try {
    outcomes = await runLotBatch(d1, [
      ...officerStatements,
      ...inserts,
      ...lotClosingStatements(d1, {
        batchId,
        userId,
        fileName: req.file_name,
        serverErrorRows,
        attemptedRows: savable.length,
      }),
    ]);
  } catch (err) {
    // Cleanup is best effort: the insert failure below is the error the caller must see.
    if (createdBatchId !== null) await discardEmptyBatch(d1, createdBatchId).catch(() => undefined);
    throw err;
  }

  let imported = 0;
  savable.forEach((c, n) => {
    const res = results.find((r) => r.row_number === c.row.row_number);
    const outcome = outcomes[drafts.size * STATEMENTS_PER_NEW_OFFICER + n];
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
