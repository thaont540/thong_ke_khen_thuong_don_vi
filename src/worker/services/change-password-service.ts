import { AUDIT_ACTION } from "../../shared/domain-enums";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { hashPassword, verifyPassword } from "../lib/password-hash";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { deleteOtherSessionsStatement } from "./session-service";

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
  const verdict = await verifyPassword(o.currentPassword, row.password_hash);
  if (!verdict.ok) {
    throw AppError.validation("Mật khẩu hiện tại không đúng", {
      current_password: "Mật khẩu hiện tại không đúng",
    });
  }
  const newHash = await hashPassword(o.newPassword);
  await d1.batch([
    d1
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
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
