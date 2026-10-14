import { Hono } from "hono";
import { AUDIT_ACTION } from "../../shared/domain-enums";
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type MeResponse,
} from "../../shared/schemas/auth-schemas";
import { auditStatement } from "../lib/audit-log-statement";
import { parseJsonBody } from "../lib/parse-request";
import { clearSessionCookie, writeSessionCookie } from "../lib/session-cookie";
import { login } from "../services/auth-login-service";
import { changePassword } from "../services/change-password-service";
import { deleteSessionStatement } from "../services/session-service";
import type { AppEnv, SessionUser } from "../types/hono-env";

export const authRoutes = new Hono<AppEnv>();

/** Mounted at /api/me (GET / -> current user). */
export const meRoutes = new Hono<AppEnv>();

export const toMe = (u: SessionUser): MeResponse => ({
  id: u.id,
  username: u.username,
  full_name: u.fullName,
  role: u.role,
  must_change_password: u.mustChangePassword,
});

authRoutes.post("/login", async (c) => {
  const body = await parseJsonBody(c, loginRequestSchema);
  const { token, me } = await login(c.env.DB, {
    ...body,
    userAgent: c.req.header("user-agent"),
  });
  writeSessionCookie(c, token);
  c.header("Cache-Control", "no-store");
  return c.json(me);
});

authRoutes.post("/logout", async (c) => {
  const { user, session } = c.var;
  await c.env.DB.batch([
    deleteSessionStatement(c.env.DB, session.tokenHash),
    auditStatement(c.env.DB, {
      userId: user.id,
      action: AUDIT_ACTION.LOGOUT,
      entity: "user",
      entityId: user.id,
    }),
  ]);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.post("/change-password", async (c) => {
  const body = await parseJsonBody(c, changePasswordRequestSchema);
  await changePassword(c.env.DB, {
    userId: c.var.user.id,
    keepTokenHash: c.var.session.tokenHash,
    currentPassword: body.current_password,
    newPassword: body.new_password,
  });
  return c.json({ ok: true });
});

meRoutes.get("/", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(toMe(c.var.user));
});
