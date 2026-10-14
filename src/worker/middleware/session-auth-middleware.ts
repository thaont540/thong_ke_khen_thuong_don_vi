import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/app-error";
import { readSessionCookie, writeSessionCookie } from "../lib/session-cookie";
import { hashSessionToken } from "../lib/session-token";
import { lookupSession } from "../services/session-service";
import type { AppEnv } from "../types/hono-env";

const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/health"]);

/** Resolves the cookie to `c.var.user` / `c.var.session`, else 401 UNAUTHORIZED. */
export const sessionAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next();
  const token = readSessionCookie(c);
  if (!token) throw AppError.unauthorized();
  const found = await lookupSession(c.env.DB, await hashSessionToken(token));
  if (!found) throw AppError.unauthorized();
  c.set("user", found.user);
  c.set("session", found.session);
  if (found.refreshed) writeSessionCookie(c, token);
  return next();
});
