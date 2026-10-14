import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../../src/worker/app";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

describe("app", () => {
  it("GET /api/health", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("unknown /api/* is JSON 404 for a signed-in user and 401 otherwise", async () => {
    expect((await api("/api/nope")).status).toBe(401);
    await resetTestData(env.DB);
    await insertUser(env.DB, { id: 1, username: "viewer1", role: "VIEWER" });
    await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
    const res = await api("/api/nope", { token: await createSession(env.DB, 1) });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
