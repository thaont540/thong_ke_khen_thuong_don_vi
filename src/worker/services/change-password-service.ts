import { AUDIT_ACTION } from "../../shared/domain-enums";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { hashPassword, verifyPassword } from "../lib/password-hash";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { failureAuditStatements, reserveAttempt } from "./login-attempt-guard";
import { deleteOtherSessionsStatement, deleteUserSessionsStatement } from "./session-service";

/**
 * Verifies the current password (1 derivation), hashes the new one (1 derivation), then in one
 * batch: store hash, clear must_change, drop every other session, audit.
 */
export async function changePassword(
  d1: D1Database,
  o: { userId: number; keepTokenHash: string; currentPassword: string; newPassword: string },
): Promise<void> {
  const row = await d1
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(o.userId)
    .first<{ password_hash: string }>();
  if (!row) throw AppError.unauthorized();
  // A wrong current password counts toward the same lockout as login (atomic reservation).
  const reservation = await reserveAttempt(d1, o.userId, new Date());
  if (!reservation) throw AppError.accountLocked();
  const verdict = await verifyPassword(o.currentPassword, row.password_hash);
  if (!verdict.ok) {
    const statements = failureAuditStatements(d1, o.userId, reservation, {
      context: "change_password",
    });
    if (reservation.locksNow) statements.push(deleteUserSessionsStatement(d1, o.userId));
    await d1.batch(statements);
    if (reservation.locksNow) throw AppError.accountLocked();
    throw AppError.validation("Mật khẩu hiện tại không đúng", {
      current_password: "Mật khẩu hiện tại không đúng",
    });
  }
  const newHash = await hashPassword(o.newPassword);
  await d1.batch([
    d1
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 0, failed_login_count = 0,
                locked_until = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(newHash, sqlTimestamp(), o.userId),
    deleteOtherSessionsStatement(d1, o.userId, o.keepTokenHash),
    auditStatement(d1, {
      userId: o.userId,
      action: AUDIT_ACTION.PASSWORD_CHANGE,
      entity: "user",
      entityId: o.userId,
    }),
  ]);
}
