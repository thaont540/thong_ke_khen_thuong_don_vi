import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { userDtoSchema } from "../../src/shared/schemas/user-schemas";
import { deleteUser, updateUser } from "../../src/worker/services/users-service";
import { api, createSession, errorOf, sessionCount, userRow } from "./helpers/auth-helpers";
import {
  insertAward,
  insertOfficer,
  insertUser,
  resetTestData,
  TEST_PASSWORD,
} from "./helpers/test-fixtures";

let admin: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await insertUser(env.DB, { id: 2, username: "admin2" });
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

describe("GET /api/users", () => {
  it("lists with the shared DTO shape", async () => {
    const res = await api("/api/users", { token: admin });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: unknown[];
      total: number;
      page: number;
      size: number;
    };
    expect(data).toMatchObject({ total: 3, page: 1, size: 10 });
    for (const item of data.items) userDtoSchema.parse(item);
    expect(JSON.stringify(data)).not.toContain("password_hash");
  });

  it("searches username and full_name (case-insensitive, BR-07 normalisation) and paginates", async () => {
    await env.DB.prepare("UPDATE users SET full_name = 'Nguyễn Văn Ân' WHERE id = 3").run();
    const byName = (await (
      await api("/api/users?q=NGUY%E1%BB%84N%20%20v%C4%83n", { token: admin })
    ).json()) as { total: number; items: { id: number }[] };
    expect(byName.items.map((i) => i.id)).toEqual([3]);
    const byUser = (await (await api("/api/users?q=ADMIN", { token: admin })).json()) as {
      total: number;
    };
    expect(byUser.total).toBe(2);
    const page2 = (await (await api("/api/users?size=2&page=2", { token: admin })).json()) as {
      items: unknown[];
      total: number;
    };
    expect(page2).toMatchObject({ total: 3 });
    expect(page2.items).toHaveLength(1);
  });

  it("reports is_locked for a temporary lock", async () => {
    await env.DB.prepare(
      "UPDATE users SET locked_until = datetime('now','+10 minutes') WHERE id = 3",
    ).run();
    const data = (await (await api("/api/users?q=editor1", { token: admin })).json()) as {
      items: { is_locked: boolean }[];
    };
    expect(data.items[0]?.is_locked).toBe(true);
  });
});

describe("POST /api/users", () => {
  const body = {
    username: "newuser",
    full_name: "Người Mới",
    role: "VIEWER",
    temp_password: "Temp-pass-12345",
  };

  it("creates a user that must change password, and the temp password works", async () => {
    const res = await api("/api/users", { token: admin, body });
    expect(res.status).toBe(201);
    const dto = userDtoSchema.parse(await res.json());
    expect(dto).toMatchObject({
      username: "newuser",
      role: "VIEWER",
      must_change_password: true,
      is_active: true,
    });
    const audit = await env.DB.prepare(
      "SELECT entity_id, user_id, detail FROM audit_logs WHERE action = 'CREATE'",
    ).first<{ entity_id: number; user_id: number; detail: string }>();
    expect(audit).toMatchObject({ entity_id: dto.id, user_id: 1 });
    expect(audit?.detail).not.toContain("Temp-pass");
    const login = await api("/api/auth/login", {
      body: { username: "newuser", password: body.temp_password },
    });
    expect(login.status).toBe(200);
    expect(((await login.json()) as { must_change_password: boolean }).must_change_password).toBe(
      true,
    );
  });

  it("duplicate username (case-insensitive) -> 409 with field error", async () => {
    const res = await api("/api/users", { token: admin, body: { ...body, username: "ADMIN1" } });
    expect(res.status).toBe(409);
    expect((await errorOf(res)).fields).toHaveProperty("username");
  });

  it("validates input", async () => {
    const res = await api("/api/users", {
      token: admin,
      body: { ...body, username: "x", temp_password: "short" },
    });
    expect(res.status).toBe(400);
    const fields = (await errorOf(res)).fields ?? {};
    expect(fields).toHaveProperty("username");
    expect(fields).toHaveProperty("temp_password");
  });
});

describe("PUT /api/users/:id", () => {
  it("updates name; username is not changeable", async () => {
    const res = await put(3, { full_name: "Biên Tập Mới", username: "hacker" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ username: "editor1", full_name: "Biên Tập Mới" });
  });

  it("role change deletes the target's sessions (and only theirs)", async () => {
    await createSession(env.DB, 3);
    await createSession(env.DB, 3);
    expect((await put(3, { role: "VIEWER" })).status).toBe(200);
    expect(await sessionCount(env.DB, 3)).toBe(0);
    expect(await sessionCount(env.DB, 1)).toBe(1);
    expect(await auditCount("UPDATE")).toBe(1);
  });

  it("lock then unlock via is_active, with sessions dropped and audit rows", async () => {
    await createSession(env.DB, 3);
    await env.DB.prepare(
      "UPDATE users SET failed_login_count = 2, locked_until = datetime('now','+5 minutes') WHERE id = 3",
    ).run();
    expect((await put(3, { is_active: false })).status).toBe(200);
    expect(await sessionCount(env.DB, 3)).toBe(0);
    expect(await auditCount("LOCK")).toBe(1);
    const login = await api("/api/auth/login", {
      body: { username: "editor1", password: TEST_PASSWORD },
    });
    expect(login.status).toBe(423);

    const res = await put(3, { is_active: true });
    expect(((await res.json()) as { is_active: boolean; is_locked: boolean }).is_locked).toBe(
      false,
    );
    expect(await auditCount("UNLOCK")).toBe(1);
    expect((await userRow(env.DB, 3))?.failed_login_count).toBe(0);
    expect(
      (await api("/api/auth/login", { body: { username: "editor1", password: TEST_PASSWORD } }))
        .status,
    ).toBe(200);
  });

  it("blocks self demote and self lock but allows renaming self", async () => {
    expect((await put(1, { role: "EDITOR" })).status).toBe(409);
    expect((await put(1, { is_active: false })).status).toBe(409);
    expect((await put(1, { full_name: "Tôi" })).status).toBe(200);
    expect(await auditCount("UPDATE")).toBe(1);
    expect((await userRow(env.DB, 1))?.role).toBe("ADMIN");
  });

  it("last-admin guard trips in SQL without audit rows or session loss", async () => {
    // Unreachable through the API (the acting admin always counts); simulate a lost race by
    // calling the service with a non-admin actor while admin1 is the only active admin.
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = 2").run();
    await expect(updateUser(env.DB, 3, 1, { role: "VIEWER" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(updateUser(env.DB, 3, 1, { is_active: false })).rejects.toMatchObject({
      status: 409,
    });
    await expect(deleteUser(env.DB, 3, 1)).rejects.toMatchObject({ status: 409 });
    expect(await userRow(env.DB, 1)).toMatchObject({ role: "ADMIN", is_active: 1 });
    expect(await sessionCount(env.DB, 1)).toBe(1);
    expect(await auditCount("UPDATE")).toBe(0);
    expect(await auditCount("LOCK")).toBe(0);
  });

  it("404 for unknown id, 400 for bad body", async () => {
    expect((await put(999, { full_name: "x" })).status).toBe(404);
    expect((await put(3, { role: "ROOT" })).status).toBe(400);
  });
});

describe("POST /api/users/:id/reset-password", () => {
  it("sets a one-time temp password, must_change, unlock, drops sessions", async () => {
    await createSession(env.DB, 3);
    await env.DB.prepare(
      "UPDATE users SET failed_login_count = 4, locked_until = datetime('now','+5 minutes') WHERE id = 3",
    ).run();
    const res = await api("/api/users/3/reset-password", { method: "POST", token: admin });
    expect(res.status).toBe(200);
    const { temp_password } = (await res.json()) as { temp_password: string };
    expect(temp_password).toHaveLength(16);

    const row = await userRow(env.DB, 3);
    expect(row).toMatchObject({
      must_change_password: 1,
      failed_login_count: 0,
      locked_until: null,
    });
    expect(await sessionCount(env.DB, 3)).toBe(0);
    expect(await auditCount("PASSWORD_RESET")).toBe(1);
    const detail = JSON.stringify((await env.DB.prepare("SELECT * FROM audit_logs").all()).results);
    expect(detail).not.toContain(temp_password);

    const login = await api("/api/auth/login", {
      body: { username: "editor1", password: temp_password },
    });
    expect(login.status).toBe(200);
    expect(((await login.json()) as { must_change_password: boolean }).must_change_password).toBe(
      true,
    );
  });

  it("404 for unknown, 409 for self", async () => {
    expect(
      (await api("/api/users/999/reset-password", { method: "POST", token: admin })).status,
    ).toBe(404);
    expect(
      (await api("/api/users/1/reset-password", { method: "POST", token: admin })).status,
    ).toBe(409);
  });
});

describe("DELETE /api/users/:id", () => {
  const del = (id: number) => api(`/api/users/${id}`, { method: "DELETE", token: admin });

  it("deletes a fresh user (sessions cascade) and audits it", async () => {
    await createSession(env.DB, 3);
    expect((await del(3)).status).toBe(200);
    expect(await userRow(env.DB, 3)).toBeNull();
    expect(await sessionCount(env.DB, 3)).toBe(0);
    expect(await auditCount("DELETE")).toBe(1);
  });

  it("409 when the user created officers or awards", async () => {
    await insertOfficer(env.DB, { id: 10 });
    await env.DB.prepare("UPDATE officers SET created_by = 3 WHERE id = 10").run();
    const res = await del(3);
    expect(res.status).toBe(409);
    expect(await userRow(env.DB, 3)).not.toBeNull();
    expect(await auditCount("DELETE")).toBe(0);

    await insertAward(env.DB, { id: 20, officerId: 10 });
    await env.DB.prepare("UPDATE officers SET created_by = NULL WHERE id = 10").run();
    await env.DB.prepare("UPDATE awards SET created_by = 3 WHERE id = 20").run();
    expect((await del(3)).status).toBe(409);
  });

  it("409 when the user has audit history (e.g. has logged in)", async () => {
    await api("/api/auth/login", { body: { username: "editor1", password: TEST_PASSWORD } });
    expect((await del(3)).status).toBe(409);
  });

  it("409 for self, 404 for unknown", async () => {
    expect((await del(1)).status).toBe(409);
    expect((await del(999)).status).toBe(404);
  });
});
