import type { Role } from "../../shared/domain-enums";
import { SESSION_TTL_SECONDS } from "../lib/session-cookie";
import { addSeconds, sqlTimestamp } from "../lib/sql-timestamp";
import type { SessionInfo, SessionUser } from "../types/hono-env";

/** last_seen_at (and sliding expiry) is only written when older than this. */
export const SESSION_REFRESH_AFTER_SECONDS = 15 * 60;
const USER_AGENT_MAX = 200;

interface SessionRow {
  token_hash: string;
  expires_at: string;
  last_seen_at: string;
  id: number;
  username: string;
  full_name: string;
  role: Role;
  must_change_password: number;
}

export interface LookedUpSession {
  user: SessionUser;
  session: SessionInfo;
  /** True when last_seen_at/expires_at were just extended (caller re-issues the cookie). */
  refreshed: boolean;
}

export function createSessionStatement(
  d1: D1Database,
  o: { tokenHash: string; userId: number; userAgent: string | undefined; now: Date },
): D1PreparedStatement {
  const ts = sqlTimestamp(o.now);
  return d1
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      o.tokenHash,
      o.userId,
      sqlTimestamp(addSeconds(o.now, SESSION_TTL_SECONDS)),
      ts,
      o.userAgent ? o.userAgent.slice(0, USER_AGENT_MAX) : null,
    );
}

/**
 * One SELECT (session JOIN user, active only, unexpired). Adds one UPDATE only when
 * last_seen_at is older than 15 minutes (sliding 8h expiry).
 */
export async function lookupSession(
  d1: D1Database,
  tokenHash: string,
  now: Date = new Date(),
): Promise<LookedUpSession | null> {
  const nowTs = sqlTimestamp(now);
  const row = await d1
    .prepare(
      `SELECT s.token_hash, s.expires_at, s.last_seen_at,
              u.id, u.username, u.full_name, u.role, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`,
    )
    .bind(tokenHash, nowTs)
    .first<SessionRow>();
  if (!row) return null;

  let expiresAt = row.expires_at;
  const stale = sqlTimestamp(addSeconds(now, -SESSION_REFRESH_AFTER_SECONDS));
  const refreshed = row.last_seen_at < stale;
  if (refreshed) {
    expiresAt = sqlTimestamp(addSeconds(now, SESSION_TTL_SECONDS));
    await d1
      .prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?")
      .bind(nowTs, expiresAt, tokenHash)
      .run();
  }
  return {
    user: {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      mustChangePassword: row.must_change_password === 1,
    },
    session: { tokenHash: row.token_hash, expiresAt },
    refreshed,
  };
}

export const deleteSessionStatement = (d1: D1Database, tokenHash: string) =>
  d1.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash);

export const deleteUserSessionsStatement = (d1: D1Database, userId: number) =>
  d1.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId);

export const deleteOtherSessionsStatement = (
  d1: D1Database,
  userId: number,
  keepTokenHash: string,
) =>
  d1
    .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?")
    .bind(userId, keepTokenHash);
