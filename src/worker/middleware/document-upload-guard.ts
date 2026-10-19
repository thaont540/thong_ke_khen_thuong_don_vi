import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import { DOCUMENT_MAX_BYTES } from "../../shared/schemas/document-schemas";
import type { AppEnv } from "../types/hono-env";
import { apiBodyLimit } from "./api-hardening-middleware";

/** The only two routes that take multipart bodies: POST /api/documents, PUT /api/documents/:id. */
export function isDocumentUpload(method: string, path: string): boolean {
  if (method === "POST") return /^\/api\/documents\/?$/.test(path);
  if (method === "PUT") return /^\/api\/documents\/\d+\/?$/.test(path);
  return false;
}

/** File cap plus 64 KB of multipart framing and metadata fields. */
const documentBodyLimit = bodyLimit({
  maxSize: DOCUMENT_MAX_BYTES + 64 * 1024,
  onError: (c) =>
    c.json({ error: { code: ERROR_CODE.VALIDATION, message: "Tệp vượt quá 20 MB" } }, 413),
});

/** Replaces the global 256 KB cap on upload routes only; every other write keeps `apiBodyLimit`. */
export const apiOrDocumentBodyLimit = createMiddleware<AppEnv>((c, next) =>
  isDocumentUpload(c.req.method, c.req.path) ? documentBodyLimit(c, next) : apiBodyLimit(c, next),
);
