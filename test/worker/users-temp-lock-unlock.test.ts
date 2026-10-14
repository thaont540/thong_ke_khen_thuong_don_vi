import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api, createSession, userRow } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

let admin: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await insertUser(env.DB, { id: 3, username: "editor1", role: "EDITOR" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  admin = await createSession(env.DB, 1);
});

const put = (id: number, body: unknown) =>
  api(`/api/users/${id}`, { method: "PUT", token: admin, body });
const auditCount = async (action: string) =>
  (
    (await env.DB.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action = ?")
      .bind(action)
      .first<{ n: number }>()) as { n: number }
  ).n;

describe("admin unlock of a failed-login (temporary) lock", () => {
  it("is_active:true on an active but temp-locked user clears the lock and audits UNLOCK", async () => {
    await env.DB.prepare(
      "UPDATE users SET failed_login_count = 3, locked_until = datetime('now','+10 minutes') WHERE id = 3",
    ).run();
    const res = await put(3, { is_active: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { is_locked: boolean }).is_locked).toBe(false);
    const row = await userRow(env.DB, 3);
    expect(row?.locked_until).toBeNull();
    expect(row?.failed_login_count).toBe(0);
    expect(await auditCount("UNLOCK")).toBe(1);
    expect(
      (await api("/api/auth/login", { body: { username: "editor1", password: TEST_PASSWORD } }))
        .status,
    ).toBe(200);
  });

  it("renaming a temp-locked user does not unlock it", async () => {
    await env.DB.prepare(
      "UPDATE users SET locked_until = datetime('now','+10 minutes') WHERE id = 3",
    ).run();
    expect((await put(3, { full_name: "Tên mới" })).status).toBe(200);
    expect((await userRow(env.DB, 3))?.locked_until).not.toBeNull();
    expect(await auditCount("UNLOCK")).toBe(0);
  });
});
