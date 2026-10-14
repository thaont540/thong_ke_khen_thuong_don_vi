import { env } from "cloudflare:workers";
import { app } from "../../../src/worker/app";
import { generateSessionToken, hashSessionToken } from "../../../src/worker/lib/session-token";
import { addSeconds, sqlTimestamp } from "../../../src/worker/lib/sql-timestamp";

export const ORIGIN = "http://localhost";

export interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Raw session token (as stored in the cookie). */
  token?: string;
  headers?: Record<string, string>;
}

/** Calls the app like a same-origin browser: Origin + JSON content-type unless overridden. */
export function api(path: string, o: ApiOptions = {}): Promise<Response> {
  const method = o.method ?? (o.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { ...o.headers };
  if (method !== "GET" && method !== "HEAD") headers.Origin ??= ORIGIN;
  if (o.body !== undefined) headers["Content-Type"] ??= "application/json";
  if (o.token) headers.Cookie = `__Host-sid=${o.token}`;
  return Promise.resolve(
    app.request(
      path,
      { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) },
      env,
    ),
  );
}

/** Inserts a session row directly (no PBKDF2) and returns the raw token for the cookie. */
export async function createSession(
  db: D1Database,
  userId: number,
  o: { expiresInSeconds?: number; lastSeenAgoSeconds?: number } = {},
): Promise<string> {
  const token = generateSessionToken();
  const now = new Date();
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at) VALUES (?, ?, ?, ?)",
    )
    .bind(
      await hashSessionToken(token),
      userId,
      sqlTimestamp(addSeconds(now, o.expiresInSeconds ?? 8 * 3600)),
      sqlTimestamp(addSeconds(now, -(o.lastSeenAgoSeconds ?? 0))),
    )
    .run();
  return token;
}

export async function errorOf(
  res: Response,
): Promise<{ code: string; message: string; fields?: Record<string, string> }> {
  return (
    (await res.json()) as {
      error: { code: string; message: string; fields?: Record<string, string> };
    }
  ).error;
}

export const sessionCount = async (db: D1Database, userId?: number): Promise<number> =>
  (
    (await (userId === undefined
      ? db.prepare("SELECT COUNT(*) n FROM sessions")
      : db.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id = ?").bind(userId)
    ).first<{ n: number }>()) as { n: number }
  ).n;

export const userRow = (db: D1Database, id: number) =>
  db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Record<string, unknown>>();
