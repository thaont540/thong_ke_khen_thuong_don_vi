import { isoToDisplay, parseDateInput } from "../../../shared/date-format";
import { parseJoinedMonth, vnYearMonth } from "../../../shared/officer-seniority";

export type VnKind = "date" | "month";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const SEGMENTS: Record<VnKind, number[]> = { date: [2, 2, 4], month: [2, 4] };
const MONTH_TEXT_RE = /^(\d{1,2})\/(\d{4})$/;

export const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

/** `dd/mm/yyyy` (1-digit day/month allowed) -> ISO `YYYY-MM-DD`; null when malformed / not a real date. */
export function parseVnDate(text: string): string | null {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text.trim()) ? parseDateInput(text) : null;
}

/** `mm/yyyy` (1-digit month allowed) -> ISO `YYYY-MM`; null when malformed. */
export function parseVnMonth(text: string): string | null {
  const m = MONTH_TEXT_RE.exec(text.trim());
  if (!m) return null;
  const iso = `${m[2]}-${pad(Number(m[1]))}`;
  return parseJoinedMonth(iso) ? iso : null;
}

export const parseVnText = (kind: VnKind, text: string): string | null =>
  kind === "date" ? parseVnDate(text) : parseVnMonth(text);

/** ISO (date or month) -> display text; non-ISO input is returned unchanged so invalid text stays visible. */
export function isoToVnText(kind: VnKind, iso: string): string {
  if (kind === "date") return isoToDisplay(iso);
  const ym = parseJoinedMonth(iso);
  return ym ? `${pad(ym.month)}/${ym.year}` : iso;
}

/**
 * Typing mask: keeps digits, splits into dd/mm/yyyy (or mm/yyyy) segments, auto-inserts the
 * slash after a full segment while the text grows (`grow=false` lets Backspace remove it).
 * A typed "/" after a 1-digit segment is kept so "5/9/2026" can be entered literally.
 */
export function maskVnText(kind: VnKind, raw: string, grow = true): string {
  const sizes = SEGMENTS[kind];
  const parts: string[] = [""];
  let trailing = false;
  for (const ch of raw) {
    const cur = parts.length - 1;
    const size = sizes[cur] ?? 0;
    if (/\d/.test(ch)) {
      let idx = cur;
      if ((parts[idx] ?? "").length >= size) {
        if (parts.length >= sizes.length) continue;
        parts.push("");
        idx += 1;
      }
      parts[idx] += ch;
      trailing = false;
    } else if (ch === "/" && parts[cur] !== "" && parts.length < sizes.length) {
      parts.push("");
      trailing = true;
    }
  }
  const last = parts.length - 1;
  const full = (parts[last] ?? "").length === sizes[last] && last < sizes.length - 1;
  if (grow && full && !trailing) parts.push("");
  return parts.join("/");
}

/** Today's calendar date in Vietnam time. */
export function vnToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const { year, month } = vnYearMonth(now);
  const day = new Date(now.getTime() + 7 * 3_600_000).getUTCDate();
  return { year, month, day };
}

export const toIsoDate = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
export const toIsoMonth = (y: number, m: number) => `${pad(y, 4)}-${pad(m)}`;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 0 = Monday ... 6 = Sunday. */
export const weekdayIndex = (y: number, m: number, d: number) =>
  (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
