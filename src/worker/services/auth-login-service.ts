import { AUDIT_ACTION, type Role } from "../../shared/domain-enums";
import type { MeResponse } from "../../shared/schemas/auth-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "../lib/password-hash";
import { generateSessionToken, hashSessionToken } from "../lib/session-token";
import { addSeconds, sqlTimestamp } from "../lib/sql-timestamp";
import { createSessionStatement } from "./session-service";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_SECONDS = 15 * 60;

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
 * Query budget: 1 SELECT + 1 batch. PBKDF2 derivations: 1 (+1 when rehashing to a higher N).
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

  const verdict = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !verdict.ok) {
    await recordFailure(d1, user, input.username, now);
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

async function recordFailure(
  d1: D1Database,
  user: LoginUserRow | null,
  username: string,
  now: Date,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  const locksNow = user !== null && user.failed_login_count + 1 >= MAX_FAILED_LOGINS;
  if (user) {
    // SET expressions all read the pre-update row, so the CASEs see the old counter.
    statements.push(
      d1
        .prepare(
          `UPDATE users SET
             locked_until = CASE WHEN failed_login_count + 1 >= ? THEN ? ELSE locked_until END,
             failed_login_count = CASE WHEN failed_login_count + 1 >= ? THEN 0
                                       ELSE failed_login_count + 1 END
           WHERE id = ?`,
        )
        .bind(
          MAX_FAILED_LOGINS,
          sqlTimestamp(addSeconds(now, LOCK_SECONDS)),
          MAX_FAILED_LOGINS,
          user.id,
        ),
    );
  }
  statements.push(
    auditStatement(d1, {
      userId: user?.id ?? null,
      action: AUDIT_ACTION.LOGIN_FAILED,
      entity: "user",
      entityId: user?.id ?? null,
      detail: { username: username.slice(0, 32) },
    }),
  );
  if (locksNow && user) {
    statements.push(
      auditStatement(d1, {
        userId: user.id,
        action: AUDIT_ACTION.LOCK,
        entity: "user",
        entityId: user.id,
        detail: {
          reason: "failed_logins",
          locked_until: sqlTimestamp(addSeconds(now, LOCK_SECONDS)),
        },
      }),
    );
  }
  await d1.batch(statements);
}
