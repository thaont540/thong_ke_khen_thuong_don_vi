import { FORM } from "../../shared/domain-enums";
import type { ImportRowCheck } from "../../shared/import/import-row-validator";
import { ratingExistsMessage } from "../../shared/import/import-rows-validator";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";

const RATING_OF_YEAR = `SELECT 1 AS hit FROM awards a JOIN award_types t ON t.id = a.award_type_id
  WHERE a.officer_id = ? AND a.year = ? AND a.deleted_at IS NULL AND t.form = 'XEP_LOAI' LIMIT 1`;

/**
 * Hard rule (not a "may be duplicate" warning): an officer with a rating for the year cannot get
 * another. Rating rows of existing officers whose year is already rated become errors; officers
 * still to be created cannot have one.
 */
export async function rejectExistingRatings(
  d1: D1Database,
  master: MasterDataDto,
  checks: readonly ImportRowCheck[],
): Promise<ImportRowCheck[]> {
  const isRating = new Set(
    master.award_types.filter((t) => t.form === FORM.XEP_LOAI).map((t) => t.id),
  );
  const targets = checks.flatMap((c, i) => {
    const input = c.input;
    return input?.subject === "CA_NHAN" && input.officer_id > 0 && isRating.has(input.award_type_id)
      ? [{ i, officerId: input.officer_id, year: input.year }]
      : [];
  });
  if (targets.length === 0) return [...checks];
  const answers = await d1.batch<{ hit: number }>(
    targets.map((t) => d1.prepare(RATING_OF_YEAR).bind(t.officerId, t.year)),
  );
  const rejected = new Map<number, string>();
  targets.forEach((t, n) => {
    if ((answers[n]?.results.length ?? 0) > 0) rejected.set(t.i, ratingExistsMessage(t.year));
  });
  return checks.map((c, i) => {
    const message = rejected.get(i);
    return message ? { ...c, input: null, newOfficer: null, errors: [message] } : c;
  });
}
