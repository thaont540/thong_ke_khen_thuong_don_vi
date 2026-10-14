import { Hono } from "hono";
import { AWARD_WRITER_ROLES } from "../../shared/role-permissions";
import { awardInputSchema, awardUpdateSchema } from "../../shared/schemas/award-schemas";
import { awardListQuerySchema } from "../../shared/schemas/list-query-schemas";
import { parseIdParam, parseJsonBody } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import { getAward, listAwards } from "../services/awards-list-query-service";
import { createAward, deleteAward, updateAward } from "../services/awards-write-service";
import { getMasterData } from "../services/master-data-service";
import type { AppEnv } from "../types/hono-env";

export const awardsRoutes = new Hono<AppEnv>();

const writers = requireRole(...AWARD_WRITER_ROLES);

// Any authenticated role may read the list (F01).
awardsRoutes.get("/", async (c) => {
  const query = awardListQuerySchema.parse(c.req.query());
  return c.json(await listAwards(c.env.DB, query));
});

awardsRoutes.get("/:id", writers, async (c) =>
  c.json(await getAward(c.env.DB, parseIdParam(c.req.param("id")))),
);

awardsRoutes.post("/", writers, async (c) => {
  const body = await parseJsonBody(c, awardInputSchema);
  const master = await getMasterData(c.env.DB);
  return c.json(await createAward(c.env.DB, master, c.var.user.id, body), 201);
});

awardsRoutes.put("/:id", writers, async (c) => {
  const id = parseIdParam(c.req.param("id"));
  const body = await parseJsonBody(c, awardUpdateSchema);
  const master = await getMasterData(c.env.DB);
  return c.json(await updateAward(c.env.DB, master, c.var.user.id, id, body));
});

awardsRoutes.delete("/:id", writers, async (c) => {
  await deleteAward(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")));
  return c.json({ ok: true });
});
