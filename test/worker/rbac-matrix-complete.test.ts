import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ROLE, type Role } from "../../src/shared/domain-enums";
import { app } from "../../src/worker/app";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

const ALL: readonly Role[] = [ROLE.ADMIN, ROLE.EDITOR, ROLE.VIEWER];
const WRITERS: readonly Role[] = [ROLE.ADMIN, ROLE.EDITOR];
const ADMIN: readonly Role[] = [ROLE.ADMIN];

/**
 * Single source of truth: every mounted route must be listed here. Adding a route without an
 * entry fails "every mounted route has an expected-role entry"; removing one fails the reverse.
 * `null` = public (no session needed).
 */
const EXPECTED: Record<string, readonly Role[] | null> = {
  "GET /api/health": null,
  "POST /api/auth/login": null,
  "POST /api/auth/logout": ALL,
  "POST /api/auth/change-password": ALL,
  "GET /api/me": ALL,
  "GET /api/master": ALL,
  "GET /api/users": ADMIN,
  "POST /api/users": ADMIN,
  "PUT /api/users/:id": ADMIN,
  "POST /api/users/:id/reset-password": ADMIN,
  "DELETE /api/users/:id": ADMIN,
  "GET /api/units": ADMIN,
  "GET /api/units/:id": ADMIN,
  "POST /api/units": ADMIN,
  "PUT /api/units/:id": ADMIN,
  "DELETE /api/units/:id": ADMIN,
  "GET /api/officers/options": WRITERS,
  "GET /api/officers/:id": ALL,
  "GET /api/officers": ADMIN,
  "POST /api/officers": ADMIN,
  "PUT /api/officers/:id": ADMIN,
  "DELETE /api/officers/:id": ADMIN,
  "POST /api/awards/import": WRITERS,
  "GET /api/awards": ALL,
  "GET /api/awards/:id": WRITERS,
  "POST /api/awards": WRITERS,
  "PUT /api/awards/:id": WRITERS,
  "DELETE /api/awards/:id": WRITERS,
};

/** Routes still reachable while must_change_password = 1 (mirrors the gate). */
const GATE_OPEN = new Set([
  "GET /api/me",
  "POST /api/auth/change-password",
  "POST /api/auth/logout",
]);

const norm = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
const mounted = [
  ...new Set(
    app.routes.filter((r) => r.method !== "ALL").map((r) => `${r.method} ${norm(r.path)}`),
  ),
];

const ROLE_USER: Record<Role, number> = { ADMIN: 1, EDITOR: 2, VIEWER: 3 };

async function call(key: string, token?: string) {
  const [method = "GET", pattern = ""] = key.split(" ");
  const path = pattern.replace(":id", "1");
  const hasBody = method === "POST" || method === "PUT";
  return api(path, {
    method,
    ...(token ? { token } : {}),
    ...(hasBody ? { body: {} } : {}),
  });
}

beforeEach(async () => {
  await resetTestData(env.DB);
  for (const role of ALL) {
    await insertUser(env.DB, { id: ROLE_USER[role], username: `${role.toLowerCase()}1`, role });
  }
  await env.DB.prepare("UPDATE users SET must_change_password = 0 WHERE id <= 3").run();
  await insertUser(env.DB, { id: 4, username: "mustchange1", role: ROLE.ADMIN });
});

describe("RBAC completeness (enumerates mounted Hono routes)", () => {
  it("every mounted route has an expected-role entry", () => {
    expect(mounted.filter((k) => !(k in EXPECTED))).toEqual([]);
  });

  it("every expected-role entry is a mounted route", () => {
    expect(Object.keys(EXPECTED).filter((k) => !mounted.includes(k))).toEqual([]);
  });

  it("only known catch-all middleware is mounted with method ALL", () => {
    const all = [...new Set(app.routes.filter((r) => r.method === "ALL").map((r) => r.path))];
    const allowed = new Set([
      "/api/*",
      "/api/auth/*",
      "*",
      "/api/users/*",
      "/api/units/*",
      "/api/officers/*",
    ]);
    expect(all.filter((p) => !allowed.has(p))).toEqual([]);
  });

  describe.each(Object.entries(EXPECTED))("%s", (key, roles) => {
    if (roles === null) {
      it("is public", async () => {
        expect([401, 403]).not.toContain((await call(key)).status);
      });
      return;
    }
    it("401 without a session", async () => {
      expect((await call(key)).status).toBe(401);
    });
    it.each(ALL)("%s", async (role) => {
      const res = await call(key, await createSession(env.DB, ROLE_USER[role]));
      if (roles.includes(role)) expect([401, 403]).not.toContain(res.status);
      else expect(res.status).toBe(403);
    });
    it("must_change_password user is gated unless the route is whitelisted", async () => {
      const res = await call(key, await createSession(env.DB, 4));
      if (GATE_OPEN.has(key)) expect([401, 403]).not.toContain(res.status);
      else expect(res.status).toBe(403);
    });
  });
});
