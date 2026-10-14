/** BR-07: case-insensitive, single-spaced, NFC. Used for every *_search column and name matching. */
export function normalizeText(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Keeps the original casing but collapses whitespace and normalizes to NFC (display names). */
export function collapseSpaces(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}
