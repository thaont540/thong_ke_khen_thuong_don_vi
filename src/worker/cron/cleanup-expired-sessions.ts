/** Nightly Cron Trigger job. Returns the number of deleted sessions. */
export async function cleanupExpiredSessions(d1: D1Database): Promise<number> {
  const res = await d1
    .prepare(
      "DELETE FROM sessions WHERE expires_at < datetime('now') OR created_at < datetime('now', '-7 days')",
    )
    .run();
  return res.meta.changes;
}
