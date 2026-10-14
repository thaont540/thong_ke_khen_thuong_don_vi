export interface BlockingUsage {
  officers: number;
  awards: number;
  /** Of the totals above, how many are soft-deleted (still referenced by FK, still block). */
  deleted_officers: number;
  deleted_awards: number;
}

/** SQL selecting totals and soft-deleted counts of officers/awards referencing `column` = ?. */
export const usageSql = (column: "unit_id" | "team_id") =>
  `SELECT (SELECT COUNT(*) FROM officers WHERE ${column} = ?) AS officers,
          (SELECT COUNT(*) FROM awards WHERE ${column} = ?) AS awards,
          (SELECT COUNT(*) FROM officers WHERE ${column} = ? AND deleted_at IS NOT NULL) AS deleted_officers,
          (SELECT COUNT(*) FROM awards WHERE ${column} = ? AND deleted_at IS NOT NULL) AS deleted_awards`;

/** "x cán bộ và y khen thưởng", flagged when soft-deleted rows are part of the count. */
export function usageText(u: BlockingUsage, scope = ""): string {
  const base = `${u.officers} cán bộ và ${u.awards} khen thưởng${scope}`;
  return u.deleted_officers + u.deleted_awards > 0
    ? `${base} (kể cả dữ liệu đã xóa, có thể khôi phục)`
    : base;
}
