import { Hono } from "hono";
import { ADMIN_ONLY } from "../../shared/role-permissions";
import { searchListQuerySchema } from "../../shared/schemas/list-query-schemas";
import { unitUpsertSchema } from "../../shared/schemas/unit-schemas";
import { parseIdParam, parseJsonBody } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import {
  createUnit,
  deleteUnit,
  getUnitDetail,
  listUnits,
  updateUnit,
} from "../services/units-service";
import type { AppEnv } from "../types/hono-env";

export const unitsRoutes = new Hono<AppEnv>();

unitsRoutes.use("*", requireRole(...ADMIN_ONLY));

unitsRoutes.get("/", async (c) =>
  c.json(await listUnits(c.env.DB, searchListQuerySchema.parse(c.req.query()))),
);

unitsRoutes.get("/:id", async (c) =>
  c.json(await getUnitDetail(c.env.DB, parseIdParam(c.req.param("id")))),
);

unitsRoutes.post("/", async (c) => {
  const body = await parseJsonBody(c, unitUpsertSchema);
  return c.json(await createUnit(c.env.DB, c.var.user.id, body), 201);
});

unitsRoutes.put("/:id", async (c) => {
  const body = await parseJsonBody(c, unitUpsertSchema);
  return c.json(await updateUnit(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")), body));
});

unitsRoutes.delete("/:id", async (c) => {
  await deleteUnit(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")));
  return c.json({ ok: true });
});
