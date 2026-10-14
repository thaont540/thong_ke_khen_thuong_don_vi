import { Hono } from "hono";
import type { AppEnv } from "../types/hono-env";

// Stub: filled by a later phase. Mount point is fixed in app.ts.
export const authRoutes = new Hono<AppEnv>();

/** Mounted at /api/me (GET / -> current user, phase 03). */
export const meRoutes = new Hono<AppEnv>();
