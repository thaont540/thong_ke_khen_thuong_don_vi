import { Hono } from "hono";
import { ADMIN_ONLY } from "../../shared/role-permissions";
import { searchListQuerySchema } from "../../shared/schemas/list-query-schemas";
import { userCreateSchema, userUpdateSchema } from "../../shared/schemas/user-schemas";
import { parseIdParam, parseJsonBody } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  updateUser,
} from "../services/users-service";
import type { AppEnv } from "../types/hono-env";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.use("*", requireRole(...ADMIN_ONLY));

usersRoutes.get("/", async (c) => {
  const query = searchListQuerySchema.parse(c.req.query());
  return c.json(await listUsers(c.env.DB, query));
});

usersRoutes.post("/", async (c) => {
  const body = await parseJsonBody(c, userCreateSchema);
  return c.json(await createUser(c.env.DB, c.var.user.id, body), 201);
});

usersRoutes.put("/:id", async (c) => {
  const body = await parseJsonBody(c, userUpdateSchema);
  return c.json(await updateUser(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")), body));
});

usersRoutes.post("/:id/reset-password", async (c) =>
  c.json(await resetPassword(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")))),
);

usersRoutes.delete("/:id", async (c) => {
  await deleteUser(c.env.DB, c.var.user.id, parseIdParam(c.req.param("id")));
  return c.json({ ok: true });
});
