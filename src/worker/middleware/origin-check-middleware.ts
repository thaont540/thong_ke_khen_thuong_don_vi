import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/app-error";
import type { AppEnv } from "../types/hono-env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for every state-changing request (Hono's `csrf` skips JSON bodies):
 * `Origin` must equal the request origin, and any request carrying a body must be JSON.
 */
export const originCheck = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const origin = c.req.header("origin");
  if (!origin || origin !== new URL(c.req.url).origin) {
    throw AppError.forbidden("Yêu cầu bị từ chối (Origin không hợp lệ)");
  }
  // workerd exposes an empty stream (not null) for body-less POST/DELETE, so decide by headers.
  const length = Number(c.req.header("content-length") ?? "0");
  const hasBody =
    length > 0 ||
    c.req.header("transfer-encoding") !== undefined ||
    c.req.header("content-type") !== undefined;
  if (hasBody) {
    const type = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") {
      throw AppError.forbidden("Yêu cầu phải có Content-Type: application/json");
    }
  }
  return next();
});
