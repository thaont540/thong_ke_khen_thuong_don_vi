import { AUDIT_ACTION } from "../../shared/domain-enums";
import { auditStatement } from "../lib/audit-log-statement";
import { addSeconds, sqlTimestamp } from "../lib/sql-timestamp";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_SECONDS = 15 * 60;

export interface AttemptReservation {
  /** True when this very reservation reached the threshold and engaged the lock. */
  locksNow: boolean;
  lockedUntil: string | null;
}

/**
 * Atomically reserves one password attempt BEFORE the (slow) PBKDF2 verification, so a burst of
 * parallel requests cannot all pass the lock check: the conditional UPDATE only succeeds for
 * active, unlocked accounts and the counter/lock transition happens in the same statement.
 * Returns null when the account is inactive or locked (caller answers 423).
 * A correct password must reset the counter afterwards (`resetAttemptsSql`).
 */
export async function reserveAttempt(
  d1: D1Database,
  userId: number,
  now: Date,
): Promise<AttemptReservation | null> {
  const nowTs = sqlTimestamp(now);
  const row = await d1
    .prepare(
      `UPDATE users SET
         locked_until = CASE WHEN failed_login_count + 1 >= ? THEN ? ELSE locked_until END,
         failed_login_count = CASE WHEN failed_login_count + 1 >= ? THEN 0
                                   ELSE failed_login_count + 1 END
       WHERE id = ? AND is_active = 1 AND (locked_until IS NULL OR locked_until <= ?)
       RETURNING failed_login_count, locked_until`,
    )
    .bind(
      MAX_FAILED_LOGINS,
      sqlTimestamp(addSeconds(now, LOCK_SECONDS)),
      MAX_FAILED_LOGINS,
      userId,
      nowTs,
    )
    .first<{ failed_login_count: number; locked_until: string | null }>();
  if (!row) return null;
  const locksNow = row.failed_login_count === 0 && row.locked_until !== null;
  return { locksNow, lockedUntil: row.locked_until };
}

/** Audit rows for a failed password check (the counter was already bumped by `reserveAttempt`). */
export function failureAuditStatements(
  d1: D1Database,
  userId: number,
  reservation: AttemptReservation,
  detail: Record<string, unknown>,
): D1PreparedStatement[] {
  const statements = [
    auditStatement(d1, {
      userId,
      action: AUDIT_ACTION.LOGIN_FAILED,
      entity: "user",
      entityId: userId,
      detail,
    }),
  ];
  if (reservation.locksNow) {
    statements.push(
      auditStatement(d1, {
        userId,
        action: AUDIT_ACTION.LOCK,
        entity: "user",
        entityId: userId,
        detail: { reason: "failed_logins", locked_until: reservation.lockedUntil },
      }),
    );
  }
  return statements;
}
