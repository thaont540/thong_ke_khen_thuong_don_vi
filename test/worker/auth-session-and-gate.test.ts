import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api, createSession, errorOf, sessionCount } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

const lastSeen = async () =>
  (await env.DB.prepare("SELECT last_seen_at, expires_at FROM sessions").first<{
    last_seen_at: string;
    expires_at: string;
  }>()) as { last_seen_at: string; expires_at: string };

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
});

describe("session middleware", () => {
  it("GET /api/me returns the current user", async () => {
    const token = await createSession(env.DB, 1);
    const res = await api("/api/me", { token });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 1,
      username: "admin1",
      full_name: "admin1",
      role: "ADMIN",
      must_change_password: false,
    });
  });

  it("no cookie, unknown token, expired session and inactive user all give 401", async () => {
    expect((await api("/api/me")).status).toBe(401);
    expect((await api("/api/me", { token: "not-a-real-token" })).status).toBe(401);
    const expired = await createSession(env.DB, 1, { expiresInSeconds: -1 });
    const res = await api("/api/me", { token: expired });
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe("UNAUTHORIZED");

    const ok = await createSession(env.DB, 1);
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = 1").run();
    expect((await api("/api/me", { token: ok })).status).toBe(401);
  });

  it("/api/health stays public", async () => {
    expect((await api("/api/health")).status).toBe(200);
  });

  it("does not touch the session within 15 minutes", async () => {
    const token = await createSession(env.DB, 1, { lastSeenAgoSeconds: 600 });
    const before = await lastSeen();
    const res = await api("/api/me", { token });
    expect(await lastSeen()).toEqual(before);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refreshes last_seen_at, expiry and cookie once older than 15 minutes", async () => {
    const token = await createSession(env.DB, 1, {
      lastSeenAgoSeconds: 20 * 60,
      expiresInSeconds: 3600,
    });
    const before = await lastSeen();
    const res = await api("/api/me", { token });
    const after = await lastSeen();
    expect(after.last_seen_at > before.last_seen_at).toBe(true);
    expect(after.expires_at > before.expires_at).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=28800");
  });
});

describe("logout", () => {
  it("deletes the session, clears the cookie, and the next call is 401", async () => {
    const token = await createSession(env.DB, 1);
    const res = await api("/api/auth/logout", { method: "POST", token });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/__Host-sid=;.*Max-Age=0/);
    expect(await sessionCount(env.DB)).toBe(0);
    expect((await api("/api/me", { token })).status).toBe(401);
    const log = await env.DB.prepare(
      "SELECT COUNT(*) n FROM audit_logs WHERE action = 'LOGOUT'",
    ).first<{ n: number }>();
    expect(log?.n).toBe(1);
  });
});

describe("must-change-password gate", () => {
  beforeEach(async () => {
    await env.DB.prepare("UPDATE users SET must_change_password = 1").run();
  });

  it("blocks business endpoints with 403 PASSWORD_CHANGE_REQUIRED", async () => {
    const token = await createSession(env.DB, 1);
    for (const path of ["/api/awards", "/api/master", "/api/users"]) {
      const res = await api(path, { token });
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe("PASSWORD_CHANGE_REQUIRED");
    }
  });

  it("still allows /api/me and logout", async () => {
    const token = await createSession(env.DB, 1);
    const me = await api("/api/me", { token });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { must_change_password: boolean }).must_change_password).toBe(
      true,
    );
    expect((await api("/api/auth/logout", { method: "POST", token })).status).toBe(200);
  });
});
