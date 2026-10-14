import { Hono } from "hono";
import { ADMIN_ONLY } from "../../shared/role-permissions";
import { officerListQuerySchema } from "../../shared/schemas/list-query-schemas";
import { officerInputSchema } from "../../shared/schemas/officer-schemas";
import { parseIdParam, parseJsonBody } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import {
  createOfficer,
  deleteOfficer,
  listOfficers,
  updateOfficer,
} from "../services/officers-service";
import type { AppEnv } from "../types/hono-env";

/** Admin CRUD. `GET /options` and `GET /:id` live in officer-lookup-routes (mounted first). */
export const officersAdminRoutes = new Hono<AppEnv>();

officersAdminRoutes.use("*", requireRole(...ADMIN_ONLY));

officersAdminRoutes.get("/", async (c) =>
  c.json(await listOfficers(c.env.DB, officerListQuerySchema.parse(c.req.query()))),
);

officersAdminRoutes.post("/", async (c) => {
  const body = await parseJsonBody(c, officerInputSchema);
  return c.json(await createOfficer(c.env.DB, c.var.user.id, body), 201);
});

officersAdminRoutes.put("/:id", async (c) => {
  const body = await parseJsonBody(c, officerInputSchema);
  return c.json(
    await updateOfficer(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")), body),
  );
});

officersAdminRoutes.delete("/:id", async (c) =>
  c.json({
    ok: true,
    ...(await deleteOfficer(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")))),
  }),
);
