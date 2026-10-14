import { Hono } from "hono";
import { AWARD_WRITER_ROLES } from "../../shared/role-permissions";
import { officerOptionsQuerySchema } from "../../shared/schemas/list-query-schemas";
import { parseIdParam } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import { getOfficerDetail, listOfficerOptions } from "../services/officer-lookup-service";
import type { AppEnv } from "../types/hono-env";

/**
 * Mounted BEFORE the admin officers router on the same prefix: only per-route middleware here,
 * so unmatched methods/paths (POST/PUT/DELETE, GET /) fall through to the admin router.
 */
export const officerLookupRoutes = new Hono<AppEnv>();

officerLookupRoutes.get("/options", requireRole(...AWARD_WRITER_ROLES), async (c) =>
  c.json(await listOfficerOptions(c.env.DB, officerOptionsQuerySchema.parse(c.req.query()))),
);

// F02: every authenticated role. Non-numeric ids fall through (404 via parseIdParam).
officerLookupRoutes.get("/:id", async (c) =>
  c.json(await getOfficerDetail(c.env.DB, parseIdParam(c.req.param("id")))),
);
