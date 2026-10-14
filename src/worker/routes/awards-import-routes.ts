import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AWARD_WRITER_ROLES } from "../../shared/role-permissions";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import { importRequestSchema } from "../../shared/schemas/award-import-schemas";
import { parseJsonBody } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import { importAwardsLot } from "../services/award-import-service";
import { getMasterData } from "../services/master-data-service";
import type { AppEnv } from "../types/hono-env";

/** 30 rows with the longest cells stay far below this; larger bodies are rejected early. */
const MAX_BODY_BYTES = 256 * 1024;

export const awardsImportRoutes = new Hono<AppEnv>();

// F04: one lot (<= 30 rows) per request. Role check first so VIEWER never reaches parsing.
awardsImportRoutes.post(
  "/",
  requireRole(...AWARD_WRITER_ROLES),
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) =>
      c.json({ error: { code: ERROR_CODE.VALIDATION, message: "Yêu cầu import quá lớn" } }, 413),
  }),
  async (c) => {
    const body = await parseJsonBody(c, importRequestSchema);
    const master = await getMasterData(c.env.DB);
    return c.json(await importAwardsLot(c.env.DB, master, c.var.user.id, body));
  },
);
