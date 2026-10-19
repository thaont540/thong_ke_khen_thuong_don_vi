import {
  existingRecordMessage,
  findIntraFileDuplicates,
  intraFileMessage,
} from "../../shared/import/import-duplicate-identity";
import { buildImportLookups, type ImportOfficer } from "../../shared/import/import-lookup-maps";
import type { ImportRowCheck } from "../../shared/import/import-row-validator";
import {
  markRepeatedRatings,
  validateImportRowsBase,
} from "../../shared/import/import-rows-validator";
import { normalizeText } from "../../shared/normalize-text";
import type { ImportRow } from "../../shared/schemas/award-import-schemas";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";
import { findDuplicatesBulk } from "./award-duplicate-check-service";
import { rejectExistingRatings } from "./award-import-rating-check";
import { findAwardProblem } from "./award-validation-service";
import { duplicateKeyOf } from "./award-write-statements";

export interface CheckedRow {
  row: ImportRow;
  check: ImportRowCheck;
  /** Non-empty => status DUPLICATE (BR-08 warning, only saved with include_duplicates). */
  duplicateMessages: string[];
}

/** One query: active officers whose normalized name appears in the lot (<= 30 names). */
async function loadOfficers(d1: D1Database, rows: readonly ImportRow[]): Promise<ImportOfficer[]> {
  const names = [
    ...new Set(rows.map((r) => normalizeText(r.full_name ?? "")).filter((n) => n.length > 0)),
  ];
  if (names.length === 0) return [];
  const marks = names.map(() => "?").join(", ");
  const { results } = await d1
    .prepare(
      `SELECT id, full_name, unit_id, team_id FROM officers
       WHERE deleted_at IS NULL AND full_name_search IN (${marks})`,
    )
    .bind(...names)
    .all<ImportOfficer>();
  return results;
}

/**
 * Authoritative re-check of one lot (<= 30 rows): shared row validator + master-data rules, then
 * BR-08 against the DB (one batch of lookups) and against earlier rows of the same lot.
 * Never trusts anything computed in the browser.
 */
export async function checkImportLot(
  d1: D1Database,
  master: MasterDataDto,
  rows: readonly ImportRow[],
): Promise<CheckedRow[]> {
  const lookups = buildImportLookups(master, await loadOfficers(d1, rows));
  const ruleChecks = validateImportRowsBase(rows, lookups).map((check) => {
    const problem = check.input ? findAwardProblem(master, check.input) : null;
    return problem ? { ...check, input: null, newOfficer: null, errors: [problem.message] } : check;
  });
  // Repeated ratings last: a row that fails any other check must not poison a later valid row.
  const checks = markRepeatedRatings(
    rows,
    await rejectExistingRatings(d1, master, ruleChecks),
    master,
  );

  const valid = checks.flatMap((c, i) => (c.input ? [{ i, input: c.input }] : []));
  const dbHits = await findDuplicatesBulk(
    d1,
    valid.map((v) => duplicateKeyOf(v.input)),
  );
  const dbMessageByIndex = new Map<number, string>();
  valid.forEach((v, n) => {
    const hits = dbHits[n] ?? [];
    if (hits.length > 0) {
      dbMessageByIndex.set(
        v.i,
        existingRecordMessage([...new Set(hits.map((h) => h.decision_number))]),
      );
    }
  });
  const intra = findIntraFileDuplicates(
    rows.map((row, i) => ({ row_number: row.row_number, input: checks[i]?.input ?? null })),
  );

  return rows.map((row, i) => {
    const messages: string[] = [];
    const db = dbMessageByIndex.get(i);
    if (db) messages.push(db);
    const earlier = intra.get(row.row_number);
    if (earlier) messages.push(intraFileMessage(earlier));
    return { row, check: checks[i] as ImportRowCheck, duplicateMessages: messages };
  });
}
