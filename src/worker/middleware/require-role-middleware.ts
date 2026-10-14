import { createMiddleware } from "hono/factory";
import type { Role } from "../../shared/domain-enums";
import { AppError } from "../lib/app-error";
import type { AppEnv } from "../types/hono-env";

/** Per-router/route role guard; must run after `sessionAuth`. */
export const requireRole = (...roles: readonly Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.var.user.role)) throw AppError.forbidden();
    return next();
  });
