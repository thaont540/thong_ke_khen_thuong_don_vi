import { createMiddleware } from "hono/factory";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import { AppError } from "../lib/app-error";
import type { AppEnv } from "../types/hono-env";

export const LOGIN_RATE_LIMITED_MESSAGE = "Bạn thử quá nhiều lần, vui lòng đợi rồi thử lại";

/**
 * Per-IP throttle for POST /api/auth/login (Workers Rate Limiting binding, see wrangler.jsonc).
 * Skipped when the binding or the client IP is absent (local dev / tests); Cloudflare always sets
 * CF-Connecting-IP in production. A binding failure fails open: login stays protected by the
 * per-account lock, and an outage of the limiter must not lock everyone out.
 */
export const loginRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const limiter = (c.env as Partial<Pick<Env, "LOGIN_LIMITER">>).LOGIN_LIMITER;
  const ip = c.req.header("CF-Connecting-IP");
  if (limiter && ip) {
    let allowed = true;
    try {
      allowed = (await limiter.limit({ key: ip })).success;
    } catch (error) {
      console.error("login rate limiter failed", error);
    }
    if (!allowed) {
      c.header("Retry-After", "60");
      throw new AppError(429, ERROR_CODE.RATE_LIMITED, LOGIN_RATE_LIMITED_MESSAGE);
    }
  }
  await next();
});
