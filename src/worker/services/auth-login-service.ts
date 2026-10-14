import { AUDIT_ACTION, type Role } from "../../shared/domain-enums";
import type { MeResponse } from "../../shared/schemas/auth-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "../lib/password-hash";
import { generateSessionToken, hashSessionToken } from "../lib/session-token";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { failureAuditStatements, reserveAttempt } from "./login-attempt-guard";
import { createSessionStatement } from "./session-service";

/** Hash of a throw-away password: unknown usernames still pay one PBKDF2 derivation. */
const DUMMY_HASH = `pbkdf2$sha256$${PBKDF2_ITERATIONS}$euzO62SrwOS1AfUyGRYxrg==$arAMBDT9iqYBtNoeLnNgf3XWl79Eh4p3n9fb97lKdpQ=`;

interface LoginUserRow {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  password_hash: string;
  must_change_password: number;
  failed_login_count: number;
  locked_until: string | null;
  is_active: number;
}

export interface LoginResult {
  token: string;
  me: MeResponse;
}

const invalidCredentials = () => AppError.unauthorized("Tên đăng nhập hoặc mật khẩu không đúng");

/**
 * Query budget: 1 SELECT + 1 reservation UPDATE + 1 batch. PBKDF2 derivations: 1 (+1 when rehashing to a higher N).
 * Throws 401 (generic) or 423 (inactive / locked).
 */
export async function login(
  d1: D1Database,
  input: { username: string; password: string; userAgent: string | undefined },
  now: Date = new Date(),
): Promise<LoginResult> {
  const user = await d1
    .prepare(
      `SELECT id, username, full_name, role, password_hash, must_change_password,
              failed_login_count, locked_until, is_active
         FROM users WHERE username = ?`,
    )
    .bind(input.username)
    .first<LoginUserRow>();

  const nowTs = sqlTimestamp(now);
  if (user && (user.is_active !== 1 || (user.locked_until && user.locked_until > nowTs))) {
    throw AppError.accountLocked();
  }

  if (!user) {
    // Unknown username: pay one derivation, write nothing (no audit row, no user to update).
    await verifyPassword(input.password, DUMMY_HASH);
    throw invalidCredentials();
  }

  // Reserve the attempt atomically before verifying so parallel bursts cannot exceed the limit.
  const reservation = await reserveAttempt(d1, user.id, now);
  if (!reservation) throw AppError.accountLocked();

  const verdict = await verifyPassword(input.password, user.password_hash);
  if (!verdict.ok) {
    await d1.batch(
      failureAuditStatements(d1, user.id, reservation, { username: input.username.slice(0, 32) }),
    );
    throw invalidCredentials();
  }

  const token = generateSessionToken();
  const statements = [
    d1
      .prepare(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?,
                updated_at = ? WHERE id = ?`,
      )
      .bind(nowTs, nowTs, user.id),
    createSessionStatement(d1, {
      tokenHash: await hashSessionToken(token),
      userId: user.id,
      userAgent: input.userAgent,
      now,
    }),
    auditStatement(d1, {
      userId: user.id,
      action: AUDIT_ACTION.LOGIN,
      entity: "user",
      entityId: user.id,
    }),
  ];
  if (verdict.needsRehash) {
    statements.push(
      d1
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(await hashPassword(input.password), user.id),
    );
  }
  await d1.batch(statements);

  return {
    token,
    me: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      must_change_password: user.must_change_password === 1,
    },
  };
}
