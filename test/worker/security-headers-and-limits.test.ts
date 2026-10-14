import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/worker/app";
import { api, createSession, errorOf, ORIGIN } from "./helpers/auth-helpers";
import { insertAward, insertOfficer, insertUser, resetTestData } from "./helpers/test-fixtures";

let admin: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  admin = await createSession(env.DB, 1);
});

const big = (bytes: number) => ({ junk: "x".repeat(bytes) });

describe("body size limits", () => {
  it("auth routes cap bodies at 5 KB (anonymous too)", async () => {
    const res = await api("/api/auth/login", { method: "POST", body: big(6 * 1024) });
    expect(res.status).toBe(413);
    expect((await errorOf(res)).code).toBe("VALIDATION");
  });

  it.each([
    ["POST", "/api/users"],
    ["PUT", "/api/users/2"],
    ["POST", "/api/units"],
    ["PUT", "/api/units/1"],
    ["POST", "/api/officers"],
    ["PUT", "/api/officers/1"],
    ["POST", "/api/awards"],
    ["PUT", "/api/awards/1"],
    ["POST", "/api/awards/import"],
  ])("%s %s rejects a body over 256 KB with 413 before parsing", async (method, path) => {
    const res = await api(path, { method, token: admin, body: big(260 * 1024) });
    expect(res.status).toBe(413);
  });

  it("a normal body is not rejected by the limit", async () => {
    const res = await api("/api/users", { method: "POST", token: admin, body: big(2 * 1024) });
    expect(res.status).toBe(400);
  });
});

describe("response headers", () => {
  it("JSON API responses carry hardening headers", async () => {
    const res = await api("/api/me", { token: admin });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("errors carry them too", async () => {
    const res = await api("/api/users", { token: "" });
    expect(res.status).toBe(401);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("no internals in error responses", () => {
  it("an unexpected failure is a generic 500 without message, stack or SQL", async () => {
    const broken = {
      ...env,
      DB: {
        prepare: () => {
          throw new Error("boom at /srv/secret/path.ts:12 SELECT * FROM users");
        },
      },
    };
    const res = await app.request(
      "/api/me",
      { headers: { Cookie: `__Host-sid=${admin}`, Origin: ORIGIN } },
      broken,
    );
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "INTERNAL", message: "Lỗi hệ thống" } });
    expect(text).not.toMatch(/boom|secret|SELECT|\.ts|at /);
  });

  it("zod errors expose field messages only", async () => {
    const res = await api("/api/users", {
      method: "POST",
      token: admin,
      body: { role: 5, extra: 1 },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/stack|node_modules|\.ts/);
  });

  it("unknown API paths are a JSON 404", async () => {
    const res = await api("/api/nope", { token: admin });
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("NOT_FOUND");
  });
});

describe("LIKE wildcards in search are literals", () => {
  beforeEach(async () => {
    await insertOfficer(env.DB, { id: 1 });
    await insertAward(env.DB, { id: 1, officerId: 1 });
  });

  it.each(["%", "_", "\\", "%%", "1_5"])("awards q=%s matches nothing it should not", async (q) => {
    const res = await api(`/api/awards?q=${encodeURIComponent(q)}`, { token: admin });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { total: number }).total).toBe(0);
  });

  it("a literal underscore does not match any single character", async () => {
    const res = await api(`/api/officers?q=${encodeURIComponent("Cán bộ_")}`, { token: admin });
    expect(((await res.json()) as { total: number }).total).toBe(0);
  });
});

describe("session cookie flags", () => {
  it("login sets HttpOnly, Secure, SameSite=Strict, Path=/ with the __Host- prefix", async () => {
    await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { username: "admin1", password: "Password-12345" },
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-sid=/);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) {
      expect(cookie).toContain(flag);
    }
    expect(cookie).not.toMatch(/Domain=/i);
  });
});
