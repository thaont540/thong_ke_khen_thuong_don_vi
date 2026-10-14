const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const VN_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Strict ISO `YYYY-MM-DD` check (real calendar date). */
export function isValidIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  return m !== null && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Accepts `dd/mm/yyyy` or `yyyy-mm-dd`; returns ISO or null when malformed / not a real date. */
export function parseDateInput(s: string): string | null {
  const t = s.trim();
  if (isValidIsoDate(t)) return t;
  const m = VN_RE.exec(t);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(y, mo, d) ? `${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}` : null;
}

/** ISO -> `dd/mm/yyyy`; returns the input unchanged when it is not valid ISO. */
export function isoToDisplay(iso: string): string {
  const m = ISO_RE.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
