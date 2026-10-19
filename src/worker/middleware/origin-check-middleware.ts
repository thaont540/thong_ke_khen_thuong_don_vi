import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/app-error";
import type { AppEnv } from "../types/hono-env";
import { isDocumentUpload } from "./document-upload-guard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for every state-changing request (Hono's `csrf` skips JSON bodies):
 * `Origin` must equal the request origin, and any request carrying a body must be JSON
 * (except multipart on the document upload routes).
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
    // Narrow exception: multipart is accepted only on the document upload routes.
    const multipartOk =
      type === "multipart/form-data" && isDocumentUpload(c.req.method, c.req.path);
    if (type !== "application/json" && !multipartOk) {
      throw AppError.forbidden("Yêu cầu phải có Content-Type: application/json");
    }
  }
  return next();
});
