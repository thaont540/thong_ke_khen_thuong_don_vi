import { Hono } from "hono";
import type { AppEnv } from "../types/hono-env";

// Stub: filled by a later phase. Mount point is fixed in app.ts.
export const usersRoutes = new Hono<AppEnv>();
