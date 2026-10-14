import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api, createSession, errorOf, sessionCount, userRow } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

const NEW_PASSWORD = "Brand-new-pass-1";
const body = (o: Record<string, string> = {}) => ({
  current_password: TEST_PASSWORD,
  new_password: NEW_PASSWORD,
  confirm_password: NEW_PASSWORD,
  ...o,
});

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
});

describe("POST /api/auth/change-password", () => {
  it.each([
    ["too short", { new_password: "short", confirm_password: "short" }, "new_password"],
    [
      "same as old",
      { new_password: TEST_PASSWORD, confirm_password: TEST_PASSWORD },
      "new_password",
    ],
    ["confirm mismatch", { confirm_password: "something-else-1" }, "confirm_password"],
  ])("%s -> 400 with field error", async (_name, override, field) => {
    const token = await createSession(env.DB, 1);
    const res = await api("/api/auth/change-password", { token, body: body(override) });
    expect(res.status).toBe(400);
    const err = await errorOf(res);
    expect(err.code).toBe("VALIDATION");
    expect(err.fields).toHaveProperty(field);
  });

  it("wrong current password -> 400 on current_password, nothing changed", async () => {
    const token = await createSession(env.DB, 1);
    const res = await api("/api/auth/change-password", {
      token,
      body: body({ current_password: "not-my-password" }),
    });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).fields).toHaveProperty("current_password");
    expect((await userRow(env.DB, 1))?.must_change_password).toBe(1);
  });

  it("5 wrong current passwords lock the account, drop its sessions and answer 423", async () => {
    const token = await createSession(env.DB, 1);
    await createSession(env.DB, 1);
    const wrong = body({ current_password: "not-my-password" });
    for (let i = 0; i < 4; i++) {
      expect((await api("/api/auth/change-password", { token, body: wrong })).status).toBe(400);
    }
    expect((await userRow(env.DB, 1))?.failed_login_count).toBe(4);
    const res = await api("/api/auth/change-password", { token, body: wrong });
    expect(res.status).toBe(423);
    expect((await errorOf(res)).code).toBe("ACCOUNT_LOCKED");
    expect(await sessionCount(env.DB, 1)).toBe(0);
    expect((await userRow(env.DB, 1))?.locked_until).not.toBeNull();
    const locks = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOCK'",
    ).first<{ n: number }>();
    expect(locks?.n).toBe(1);
  });

  it("a correct change resets the failure counter", async () => {
    const token = await createSession(env.DB, 1);
    await api("/api/auth/change-password", {
      token,
      body: body({ current_password: "nope-nope" }),
    });
    expect((await userRow(env.DB, 1))?.failed_login_count).toBe(1);
    expect((await api("/api/auth/change-password", { token, body: body() })).status).toBe(200);
    expect((await userRow(env.DB, 1))?.failed_login_count).toBe(0);
  });

  it("works under the gate; clears must_change; kills other sessions, keeps current; audited", async () => {
    const current = await createSession(env.DB, 1);
    await createSession(env.DB, 1);
    await createSession(env.DB, 1);
    const res = await api("/api/auth/change-password", { token: current, body: body() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await sessionCount(env.DB, 1)).toBe(1);

    expect((await userRow(env.DB, 1))?.must_change_password).toBe(0);
    expect((await api("/api/me", { token: current })).status).toBe(200);
    expect((await api("/api/master", { token: current })).status).toBe(200);

    const logged = await env.DB.prepare(
      "SELECT detail FROM audit_logs WHERE action = 'PASSWORD_CHANGE'",
    ).all<{ detail: string | null }>();
    expect(logged.results).toHaveLength(1);
    expect(JSON.stringify(logged.results)).not.toContain(NEW_PASSWORD);

    // the new password is usable for login, the old one is not
    const ok = await api("/api/auth/login", {
      body: { username: "admin1", password: NEW_PASSWORD },
    });
    expect(ok.status).toBe(200);
    const old = await api("/api/auth/login", {
      body: { username: "admin1", password: TEST_PASSWORD },
    });
    expect(old.status).toBe(401);
  });

  it("requires a session", async () => {
    expect((await api("/api/auth/change-password", { body: body() })).status).toBe(401);
  });
});
