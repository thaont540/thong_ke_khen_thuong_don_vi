import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";

const tooLarge = (c: Parameters<NonNullable<Parameters<typeof bodyLimit>[0]["onError"]>>[0]) =>
  c.json({ error: { code: ERROR_CODE.VALIDATION, message: "Nội dung yêu cầu quá lớn" } }, 413);

/** Global cap for every API write (the largest legitimate body is an import lot of 30 rows). */
export const apiBodyLimit = bodyLimit({ maxSize: 256 * 1024, onError: tooLarge });

/** Login / change-password bodies are a few hundred bytes. */
export const authBodyLimit = bodyLimit({ maxSize: 5 * 1024, onError: tooLarge });

/**
 * Static assets get their headers from public/_headers; the Worker serves /api/* itself, so JSON
 * responses carry their own: no sniffing, no framing, nothing cacheable, nothing renderable.
 */
export const apiSecurityHeaders = secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  referrerPolicy: "same-origin",
  xFrameOptions: "DENY",
});
