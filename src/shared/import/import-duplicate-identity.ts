import type { AwardInput } from "../schemas/award-schemas";

/**
 * BR-08 identity of an award: same target + type + variant + year. Two inputs with the same string
 * are duplicates of each other (intra-file / intra-lot check; the DB check uses the same fields).
 */
export function duplicateIdentity(i: AwardInput): string {
  const target = i.subject === "CA_NHAN" ? `o${i.officer_id}` : `u${i.unit_id}t${i.team_id ?? "-"}`;
  return [i.subject, target, i.award_type_id, i.award_variant_id ?? "-", i.year].join("|");
}

export interface RowWithInput {
  row_number: number;
  input: AwardInput | null;
}

/**
 * For each row with a valid input, row numbers of valid rows above it with the same identity.
 * Result is keyed by row_number; rows without earlier twins are absent.
 */
export function findIntraFileDuplicates(rows: readonly RowWithInput[]): Map<number, number[]> {
  const seen = new Map<string, number[]>();
  const result = new Map<number, number[]>();
  for (const r of rows) {
    if (!r.input) continue;
    const id = duplicateIdentity(r.input);
    const earlier = seen.get(id);
    if (earlier) {
      result.set(r.row_number, [...earlier]);
      earlier.push(r.row_number);
    } else {
      seen.set(id, [r.row_number]);
    }
  }
  return result;
}

export const intraFileMessage = (rowNumbers: readonly number[]): string =>
  `Trùng với dòng ${rowNumbers.join(", ")} trong file`;

export const existingRecordMessage = (decisionNumbers: readonly string[]): string =>
  `Trùng với bản ghi đã có (quyết định ${decisionNumbers.join(", ")})`;

/** Intra-file warnings are computed over the whole file by the browser; a lot-local one is partial. */
export const isIntraFileMessage = (m: string): boolean => m.startsWith("Trùng với dòng ");
