import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { meResponseSchema } from "../../src/shared/schemas/auth-schemas";
import { hashSessionToken } from "../../src/worker/lib/session-token";
import { api, errorOf, sessionCount, userRow } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

const login = (username: string, password: string, headers?: Record<string, string>) =>
  api("/api/auth/login", { body: { username, password }, ...(headers ? { headers } : {}) });

const audits = async (action: string) =>
  (
    await env.DB.prepare("SELECT user_id, detail FROM audit_logs WHERE action = ?")
      .bind(action)
      .all<{ user_id: number | null; detail: string | null }>()
  ).results;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
});

describe("POST /api/auth/login", () => {
  it("logs in, sets the exact cookie flags and stores only the token hash", async () => {
    const res = await login("ADMIN1", TEST_PASSWORD, { "User-Agent": "x".repeat(300) });
    expect(res.status).toBe(200);
    const me = meResponseSchema.parse(await res.json());
    expect(me).toMatchObject({
      id: 1,
      username: "admin1",
      role: "ADMIN",
      must_change_password: true,
    });

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43};/);
    for (const part of ["Max-Age=28800", "Path=/", "HttpOnly", "Secure", "SameSite=Strict"]) {
      expect(cookie).toContain(part);
    }
    expect(cookie).not.toContain("Domain");

    const token = /__Host-sid=([^;]+)/.exec(cookie)?.[1] as string;
    const row = await env.DB.prepare("SELECT token_hash, user_agent FROM sessions").first<{
      token_hash: string;
      user_agent: string;
    }>();
    expect(row?.token_hash).toBe(await hashSessionToken(token));
    expect(row?.token_hash).not.toBe(token);
    expect(row?.user_agent).toHaveLength(200);
    expect((await userRow(env.DB, 1))?.last_login_at).not.toBeNull();
    expect(await audits("LOGIN")).toHaveLength(1);
  });

  it("wrong password and unknown user return the same 401", async () => {
    const wrong = await login("admin1", "wrong-password");
    const unknown = await login("nobody", "wrong-password");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const [a, b] = [await errorOf(wrong), await errorOf(unknown)];
    expect(a).toEqual(b);
    expect(a.message).toBe("Tên đăng nhập hoặc mật khẩu không đúng");
    expect(wrong.headers.get("set-cookie")).toBeNull();

    // Known user is audited; the unknown username writes nothing to D1 (quota amplification).
    const failed = await audits("LOGIN_FAILED");
    expect(failed.map((r) => r.user_id)).toEqual([1]);
    expect(failed.map((r) => JSON.parse(r.detail ?? "{}").username)).toEqual(["admin1"]);
    expect(JSON.stringify(failed)).not.toContain("wrong-password");
  });

  it("unknown usernames cause no D1 writes at all", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_logs").first<{
      n: number;
    }>();
    for (let i = 0; i < 3; i++) expect((await login(`ghost${i}`, "bad-password")).status).toBe(401);
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_logs").first<{
      n: number;
    }>();
    expect(after?.n).toBe(before?.n);
  });

  it("a parallel burst cannot exceed 5 password attempts; correct login afterwards is 423", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => login("admin1", `bad-password-${i}`)),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 423)).toHaveLength(5);
    const row = await userRow(env.DB, 1);
    expect(row?.locked_until).not.toBeNull();
    expect(await audits("LOCK")).toHaveLength(1);
    expect((await audits("LOGIN_FAILED")).length).toBe(5);

    const res = await login("admin1", TEST_PASSWORD);
    expect(res.status).toBe(423);
    expect(await sessionCount(env.DB)).toBe(0);
  });

  it("locks after 5 consecutive failures; correct password then gets 423", async () => {
    for (let i = 0; i < 5; i++) expect((await login("admin1", "bad-password")).status).toBe(401);
    const row = await userRow(env.DB, 1);
    expect(row?.locked_until).not.toBeNull();
    expect(row?.failed_login_count).toBe(0);
    expect(await audits("LOCK")).toHaveLength(1);

    const res = await login("admin1", TEST_PASSWORD);
    expect(res.status).toBe(423);
    expect((await errorOf(res)).code).toBe("ACCOUNT_LOCKED");
    expect(await sessionCount(env.DB)).toBe(0);
  });

  it("an expired lock allows login and resets counters", async () => {
    await env.DB.prepare(
      "UPDATE users SET locked_until = datetime('now','-1 minute'), failed_login_count = 3 WHERE id = 1",
    ).run();
    expect((await login("admin1", TEST_PASSWORD)).status).toBe(200);
    const row = await userRow(env.DB, 1);
    expect(row?.locked_until).toBeNull();
    expect(row?.failed_login_count).toBe(0);
  });

  it("a success resets the failure counter", async () => {
    await login("admin1", "bad-password");
    await login("admin1", "bad-password");
    expect((await userRow(env.DB, 1))?.failed_login_count).toBe(2);
    await login("admin1", TEST_PASSWORD);
    expect((await userRow(env.DB, 1))?.failed_login_count).toBe(0);
  });

  it("deactivated account gets 423", async () => {
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = 1").run();
    const res = await login("admin1", TEST_PASSWORD);
    expect(res.status).toBe(423);
    expect((await errorOf(res)).message).toBe("Tài khoản đang bị khóa");
  });

  it("rehashes the stored password when its iteration count is below the constant", async () => {
    const { hashPassword } = await import("../../src/worker/lib/password-hash");
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = 1")
      .bind(await hashPassword(TEST_PASSWORD, 1000))
      .run();
    expect((await login("admin1", TEST_PASSWORD)).status).toBe(200);
    const row = await userRow(env.DB, 1);
    expect(String(row?.password_hash)).toContain("$100000$");
    expect((await login("admin1", TEST_PASSWORD)).status).toBe(200);
  });

  it("rejects malformed bodies with 400 VALIDATION", async () => {
    const bad = await api("/api/auth/login", { body: { username: "", password: "" } });
    expect(bad.status).toBe(400);
    const notJson = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(notJson.status).toBe(400);
  });
});
