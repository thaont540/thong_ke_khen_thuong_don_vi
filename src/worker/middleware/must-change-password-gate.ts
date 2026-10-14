import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/app-error";
import type { AppEnv } from "../types/hono-env";

/** `METHOD path` pairs usable while must_change_password = 1. */
const ALLOWED_UNDER_GATE = new Set([
  "GET /api/me",
  "POST /api/auth/change-password",
  "POST /api/auth/logout",
]);

export const mustChangePasswordGate = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user as AppEnv["Variables"]["user"] | undefined; // unset on public paths
  if (user?.mustChangePassword && !ALLOWED_UNDER_GATE.has(`${c.req.method} ${c.req.path}`)) {
    throw AppError.passwordChangeRequired();
  }
  return next();
});
