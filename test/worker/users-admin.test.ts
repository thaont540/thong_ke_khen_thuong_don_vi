import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { userDtoSchema } from "../../src/shared/schemas/user-schemas";
import {} from "../../src/worker/services/users-service";
import { api, createSession, errorOf } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

let admin: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await insertUser(env.DB, { id: 2, username: "admin2" });
  await insertUser(env.DB, { id: 3, username: "editor1", role: "EDITOR" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  admin = await createSession(env.DB, 1);
});

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
