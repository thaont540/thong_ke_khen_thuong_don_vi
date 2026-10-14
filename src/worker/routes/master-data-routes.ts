import { Hono } from "hono";
import { getMasterData } from "../services/master-data-service";
import type { AppEnv } from "../types/hono-env";

export const masterDataRoutes = new Hono<AppEnv>();

// GET /api/master (all roles; auth middleware added in phase 03)
masterDataRoutes.get("/", async (c) => {
  const data = await getMasterData(c.env.DB);
  c.header("Cache-Control", "no-store");
  return c.json(data);
});
