import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "../../src/shared/domain-enums";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

/** Phase 05 rows: every unit route and officer admin route is ADMIN-only. */
const ROUTES: { method: string; path: string; body?: unknown }[] = [
  { method: "GET", path: "/api/units" },
  { method: "GET", path: "/api/units/1" },
  { method: "POST", path: "/api/units", body: {} },
  { method: "PUT", path: "/api/units/1", body: {} },
  { method: "DELETE", path: "/api/units/1" },
  { method: "GET", path: "/api/officers" },
  { method: "POST", path: "/api/officers", body: {} },
  { method: "PUT", path: "/api/officers/1", body: {} },
  { method: "DELETE", path: "/api/officers/1" },
];

const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"];
const tokens = {} as Record<Role, string>;

beforeEach(async () => {
  await resetTestData(env.DB);
  for (const [i, role] of ROLES.entries()) {
    await insertUser(env.DB, { id: i + 1, username: `${role.toLowerCase()}1`, role });
  }
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  for (const [i, role] of ROLES.entries()) tokens[role] = await createSession(env.DB, i + 1);
});

describe("RBAC units + officers admin", () => {
  it.each(ROUTES)("$method $path -> 401 without a session", async (r) => {
    const res = await api(r.path, { method: r.method, ...(r.body ? { body: r.body } : {}) });
    expect(res.status).toBe(401);
  });

  it.each(ROUTES.flatMap((r) => (["EDITOR", "VIEWER"] as const).map((role) => ({ ...r, role }))))(
    "$method $path as $role -> 403",
    async (r) => {
      const res = await api(r.path, {
        method: r.method,
        token: tokens[r.role],
        ...(r.body ? { body: r.body } : {}),
      });
      expect(res.status).toBe(403);
    },
  );

  it.each(
    // Mutating routes get an invalid body/id on purpose: any non-401/403 proves the role passed.
    ROUTES.map((r) => ({ ...r })),
  )("$method $path as ADMIN is allowed through", async (r) => {
    const res = await api(r.path, {
      method: r.method,
      token: tokens.ADMIN,
      ...(r.body ? { body: r.body } : {}),
    });
    expect([401, 403]).not.toContain(res.status);
  });
});
