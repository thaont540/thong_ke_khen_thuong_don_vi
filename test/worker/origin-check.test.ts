import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/worker/app";
import { api, createSession, errorOf, ORIGIN } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
});

const loginBody = { username: "admin1", password: TEST_PASSWORD };

describe("origin check", () => {
  it("rejects writes without Origin", async () => {
    const res = await api("/api/auth/login", { body: loginBody, headers: { Origin: "" } });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe("FORBIDDEN");
  });

  it("rejects writes with a foreign Origin, before any session logic", async () => {
    const res = await api("/api/auth/login", {
      body: loginBody,
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    const logout = await api("/api/auth/logout", {
      method: "POST",
      token: await createSession(env.DB, 1),
      headers: { Origin: "https://evil.example" },
    });
    expect(logout.status).toBe(403);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await api("/api/auth/login", {
      body: loginBody,
      headers: { "Content-Type": "text/plain" },
    });
    expect(res.status).toBe(403);
  });

  it("accepts body-less writes sent with an empty stream (browser logout/DELETE)", async () => {
    const token = await createSession(env.DB, 1);
    const headers = { Origin: ORIGIN, Cookie: `__Host-sid=${token}`, "Content-Length": "0" };
    const res = await app.request(
      "/api/auth/logout",
      { method: "POST", headers, body: new Uint8Array(0) },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("allows same-origin JSON writes and never checks safe methods", async () => {
    expect((await api("/api/auth/login", { body: loginBody })).status).toBe(200);
    expect((await api("/api/health", { headers: { Origin: "https://evil.example" } })).status).toBe(
      200,
    );
  });
});
