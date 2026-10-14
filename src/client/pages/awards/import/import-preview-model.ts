import {
  findIntraFileDuplicates,
  intraFileMessage,
  isIntraFileMessage,
} from "../../../../shared/import/import-duplicate-identity";
import type { ImportLookups } from "../../../../shared/import/import-lookup-maps";
import {
  type ImportRowCheck,
  validateImportRow,
} from "../../../../shared/import/import-row-validator";
import type { ImportRow, ImportRowResult } from "../../../../shared/schemas/award-import-schemas";

export type PreviewStatus = "OK" | "ERROR" | "DUPLICATE";

export interface PreviewRow {
  raw: ImportRow;
  check: ImportRowCheck;
  /** BR-08 warnings (this file + server lookup against the DB). */
  dupMessages: string[];
  /** Problems found only by the server's re-validation. */
  serverErrors: string[];
}

export const rowErrors = (r: PreviewRow): string[] => [
  ...new Set([...r.check.errors, ...r.serverErrors]),
];

export function rowStatus(r: PreviewRow): PreviewStatus {
  if (rowErrors(r).length > 0) return "ERROR";
  return r.dupMessages.length > 0 ? "DUPLICATE" : "OK";
}

/** Local validation of every row plus duplicates against earlier rows of the whole file. */
export function buildPreviewRows(rows: readonly ImportRow[], lookups: ImportLookups): PreviewRow[] {
  const checks = rows.map((raw) => validateImportRow(raw, lookups));
  const intra = findIntraFileDuplicates(
    rows.map((raw, i) => ({ row_number: raw.row_number, input: checks[i]?.input ?? null })),
  );
  return rows.map((raw, i) => {
    const earlier = intra.get(raw.row_number);
    return {
      raw,
      check: checks[i] as ImportRowCheck,
      dupMessages: earlier ? [intraFileMessage(earlier)] : [],
      serverErrors: [],
    };
  });
}

/** Merges dry-run answers: server errors and DB duplicate messages are added, identical texts collapse. */
export function applyDryRunResults(
  rows: readonly PreviewRow[],
  results: readonly ImportRowResult[],
): PreviewRow[] {
  const byRow = new Map(results.map((r) => [r.row_number, r]));
  return rows.map((row) => {
    const res = byRow.get(row.raw.row_number);
    if (!res) return row;
    return {
      ...row,
      serverErrors: res.errors.filter((e) => !row.check.errors.includes(e)),
      dupMessages: [
        ...new Set([
          ...row.dupMessages,
          ...res.duplicate_messages.filter((m) => !isIntraFileMessage(m)),
        ]),
      ],
    };
  });
}

export interface PreviewCounts {
  ok: number;
  duplicate: number;
  error: number;
}

export function countPreview(rows: readonly PreviewRow[]): PreviewCounts {
  const counts = { ok: 0, duplicate: 0, error: 0 };
  for (const r of rows) {
    const s = rowStatus(r);
    if (s === "OK") counts.ok += 1;
    else if (s === "DUPLICATE") counts.duplicate += 1;
    else counts.error += 1;
  }
  return counts;
}

/** Rows that will be sent on commit: valid rows, plus possible duplicates when the box is ticked. */
export function selectRowsToImport(rows: readonly PreviewRow[], includeDuplicates: boolean) {
  return rows.filter((r) => {
    const s = rowStatus(r);
    return s === "OK" || (s === "DUPLICATE" && includeDuplicates);
  });
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
