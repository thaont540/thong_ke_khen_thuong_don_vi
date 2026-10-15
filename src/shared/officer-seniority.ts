const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const VN_UTC_OFFSET_MS = 7 * 3_600_000; // Asia/Ho_Chi_Minh has no DST.
export const MIN_JOIN_AGE = 16;
export const EMPTY_TEXT = "—";

export interface YearMonth {
  year: number;
  month: number;
}

/** Parses `YYYY-MM` (month 01-12); null when malformed. */
export function parseJoinedMonth(s: string): YearMonth | null {
  const m = MONTH_RE.exec(s);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** Current calendar year/month in Vietnam time (`now` injectable for tests). */
export function vnYearMonth(now: Date = new Date()): YearMonth {
  const vn = new Date(now.getTime() + VN_UTC_OFFSET_MS);
  return { year: vn.getUTCFullYear(), month: vn.getUTCMonth() + 1 };
}

/** True when the joined month is later than the current Vietnam month. */
export function isJoinedMonthInFuture(joined: YearMonth, now: Date = new Date()): boolean {
  const cur = vnYearMonth(now);
  return joined.year * 12 + joined.month > cur.year * 12 + cur.month;
}

/** Seniority in whole years = current VN year - join year (months ignored); null when unknown. */
export function officerSeniorityYears(
  joinedMonth: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const joined = joinedMonth ? parseJoinedMonth(joinedMonth) : null;
  if (!joined) return null;
  return Math.max(0, vnYearMonth(now).year - joined.year);
}

export function formatSeniority(years: number | null): string {
  return years === null ? EMPTY_TEXT : `${years} năm`;
}

/** `YYYY-MM` -> `mm/yyyy`; "—" when empty/invalid. */
export function formatJoinedMonth(joinedMonth: string | null | undefined): string {
  const joined = joinedMonth ? parseJoinedMonth(joinedMonth) : null;
  return joined ? `${String(joined.month).padStart(2, "0")}/${joined.year}` : EMPTY_TEXT;
}
