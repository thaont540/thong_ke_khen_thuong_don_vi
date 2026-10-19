import { FORM } from "../domain-enums";
import type { ImportRow } from "../schemas/award-import-schemas";
import type { MasterDataDto } from "../schemas/master-data-dto";
import type { ImportLookups } from "./import-lookup-maps";
import { PendingOfficers } from "./import-pending-officers";
import { type ImportRowCheck, validateImportRow } from "./import-row-validator";

/** One rating per officer per year (hard rule, enforced by a DB trigger as well). */
export const ratingExistsMessage = (year: number): string => `Cán bộ đã có xếp loại năm ${year}`;

const repeatedRatingMessage = (year: number, rowNumber: number): string =>
  `${ratingExistsMessage(year)} (trùng với dòng ${rowNumber} trong file)`;

const isRating = (master: MasterDataDto, awardTypeId: number): boolean =>
  master.award_types.some((t) => t.id === awardTypeId && t.form === FORM.XEP_LOAI);

/**
 * Turns a valid rating row into an error when an earlier valid row of the same run rates the same
 * officer (or the same to-be-created officer) in the same year.
 */
function markRepeatedRatings(
  rows: readonly ImportRow[],
  checks: readonly ImportRowCheck[],
  master: MasterDataDto,
): ImportRowCheck[] {
  const seen = new Map<string, number>();
  return checks.map((check, i) => {
    const input = check.input;
    const rowNumber = rows[i]?.row_number ?? 0;
    if (!input || input.subject !== "CA_NHAN" || !isRating(master, input.award_type_id)) {
      return check;
    }
    const key = `${input.officer_id}|${input.year}`;
    const earlier = seen.get(key);
    if (earlier === undefined) {
      seen.set(key, rowNumber);
      return check;
    }
    return {
      ...check,
      input: null,
      newOfficer: null,
      errors: [repeatedRatingMessage(input.year, earlier)],
    };
  });
}

/**
 * Per-row checks of a whole file (browser) or one lot (Worker). Rows share one registry of officers
 * to create, so the same new person is created once; repeated ratings of one officer-year are errors.
 */
export function validateImportRows(
  rows: readonly ImportRow[],
  lk: ImportLookups,
): ImportRowCheck[] {
  const pending = new PendingOfficers();
  const checks = rows.map((row) => validateImportRow(row, lk, pending));
  return markRepeatedRatings(rows, checks, lk.master);
}
