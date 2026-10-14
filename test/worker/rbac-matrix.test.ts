import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "../../src/shared/domain-enums";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

/**
 * Table-driven over every spec §9 endpoint. Later phases append rows for their own
 * endpoints in `rbac-matrix-<feature>.test.ts` (same shape), not here.
 */
const ENDPOINTS: { method: string; path: string; body?: unknown }[] = [
  { method: "POST", path: "/api/auth/logout" },
  { method: "POST", path: "/api/auth/change-password", body: {} },
  { method: "GET", path: "/api/me" },
  { method: "GET", path: "/api/master" },
  { method: "GET", path: "/api/awards" },
  { method: "GET", path: "/api/officers/1" },
  { method: "POST", path: "/api/awards", body: {} },
  { method: "GET", path: "/api/awards/1" },
  { method: "PUT", path: "/api/awards/1", body: {} },
  { method: "DELETE", path: "/api/awards/1" },
  { method: "POST", path: "/api/awards/import", body: {} },
  { method: "GET", path: "/api/officers/options" },
  { method: "GET", path: "/api/officers" },
  { method: "POST", path: "/api/officers", body: {} },
  { method: "PUT", path: "/api/officers/1", body: {} },
  { method: "DELETE", path: "/api/officers/1" },
  { method: "GET", path: "/api/units" },
  { method: "GET", path: "/api/units/1" },
  { method: "POST", path: "/api/units", body: {} },
  { method: "PUT", path: "/api/units/1", body: {} },
  { method: "DELETE", path: "/api/units/1" },
  { method: "GET", path: "/api/users" },
  { method: "POST", path: "/api/users", body: {} },
  { method: "PUT", path: "/api/users/1", body: {} },
  { method: "POST", path: "/api/users/1/reset-password" },
  { method: "DELETE", path: "/api/users/1" },
];

/** Implemented so far: [method path-prefix] -> roles that must NOT get 401/403. */
const IMPLEMENTED_ALLOWED: Record<string, readonly Role[]> = {
  "POST /api/auth/logout": ["ADMIN", "EDITOR", "VIEWER"],
  "GET /api/me": ["ADMIN", "EDITOR", "VIEWER"],
  "GET /api/master": ["ADMIN", "EDITOR", "VIEWER"],
  "GET /api/users": ["ADMIN"],
  "POST /api/users": ["ADMIN"],
  "PUT /api/users/1": ["ADMIN"],
  "POST /api/users/1/reset-password": ["ADMIN"],
  "DELETE /api/users/1": ["ADMIN"],
};

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

describe("RBAC matrix", () => {
  it.each(ENDPOINTS)("$method $path -> 401 without a session", async (e) => {
    const res = await api(e.path, { method: e.method, ...(e.body ? { body: e.body } : {}) });
    expect(res.status).toBe(401);
  });

  it.each(
    ENDPOINTS.flatMap((e) => ROLES.map((role) => ({ ...e, role }))).filter(
      (e) => `${e.method} ${e.path}` in IMPLEMENTED_ALLOWED,
    ),
  )("$method $path as $role", async (e) => {
    const allowed = IMPLEMENTED_ALLOWED[`${e.method} ${e.path}`]?.includes(e.role) ?? false;
    const res = await api(e.path, {
      method: e.method,
      token: tokens[e.role],
      ...(e.body ? { body: e.body } : {}),
    });
    if (allowed) expect([401, 403]).not.toContain(res.status);
    else expect(res.status).toBe(403);
  });
});
