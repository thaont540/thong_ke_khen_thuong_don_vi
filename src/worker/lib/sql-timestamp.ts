/** SQLite `datetime('now')` format (UTC, `YYYY-MM-DD HH:MM:SS`) so JS and SQL values compare as strings. */
export function sqlTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
