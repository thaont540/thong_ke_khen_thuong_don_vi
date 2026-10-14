import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { unitDetailSchema } from "../../src/shared/schemas/unit-schemas";
import { api, createSession, errorOf } from "./helpers/auth-helpers";
import {
  insertAward,
  insertOfficer,
  insertUser,
  resetTestData,
  SEED,
} from "./helpers/test-fixtures";

const db = env.DB;
let token: string;

beforeEach(async () => {
  await resetTestData(db);
  // Units/teams created through the API get autoincrement ids above the seed (10 / 13).
  await db.batch([
    db.prepare("DELETE FROM units WHERE id > 10"),
    db.prepare("DELETE FROM teams WHERE id > 13"),
  ]);
  await insertUser(db, { id: 1, username: "admin1" });
  await db.prepare("UPDATE users SET must_change_password = 0").run();
  token = await createSession(db, 1);
});

const unitBody = (over: Record<string, unknown> = {}) => ({
  code: "X1",
  kind: "PHONG",
  name: "Đơn vị thử",
  description: null,
  teams: [],
  ...over,
});
const post = (body: unknown) => api("/api/units", { method: "POST", token, body });
const put = (id: number, body: unknown) => api(`/api/units/${id}`, { method: "PUT", token, body });
const del = (id: number) => api(`/api/units/${id}`, { method: "DELETE", token });
const auditCount = async (entity: string, action: string) =>
  (
    (await db
      .prepare("SELECT COUNT(*) n FROM audit_logs WHERE entity = ? AND action = ?")
      .bind(entity, action)
      .first<{ n: number }>()) as { n: number }
  ).n;

async function createUnit(over: Record<string, unknown> = {}) {
  const res = await post(unitBody(over));
  expect(res.status).toBe(201);
  return unitDetailSchema.parse(await res.json());
}

describe("PUT /api/units/:id", () => {
  it("renames a team keeping id and code; adds and removes unused teams", async () => {
    const u = await createUnit({ teams: [{ name: "Đội A" }, { name: "Đội B" }] });
    const [a, b] = u.teams;
    const res = await put(u.id, {
      ...unitBody({ name: "Đơn vị mới" }),
      teams: [{ id: a?.id, name: "Đội A đổi tên" }, { name: "Đội C" }],
    });
    expect(res.status).toBe(200);
    const after = unitDetailSchema.parse(await res.json());
    expect(after.name).toBe("Đơn vị mới");
    expect(after.teams.map((t) => [t.id, t.code, t.name])).toEqual([
      [a?.id, "X1-T1", "Đội A đổi tên"],
      [expect.any(Number), "X1-T3", "Đội C"],
    ]);
    expect(after.teams.some((t) => t.name === b?.name)).toBe(false); // ids may be reused
    expect(await auditCount("unit", "UPDATE")).toBe(1);
  });

  it("new team codes never collide with leftovers of a renamed unit's prefix", async () => {
    const first = await createUnit({ code: "X1", teams: [{ name: "Đội cũ" }] });
    // Rename the unit's code: its team keeps the old X1-T1 code.
    expect(
      (
        await put(first.id, {
          ...unitBody({ code: "X2" }),
          teams: [{ id: first.teams[0]?.id, name: "Đội cũ" }],
        })
      ).status,
    ).toBe(200);
    const second = await createUnit({
      code: "X1",
      name: "Đơn vị khác",
      teams: [{ name: "Đội mới" }],
    });
    expect(second.teams.map((t) => t.code)).toEqual(["X1-T2"]);
    const grown = await put(second.id, {
      ...unitBody({ code: "X1", name: "Đơn vị khác" }),
      teams: [{ id: second.teams[0]?.id, name: "Đội mới" }, { name: "Đội nữa" }],
    });
    expect(unitDetailSchema.parse(await grown.json()).teams.map((t) => t.code)).toEqual([
      "X1-T2",
      "X1-T3",
    ]);
  });

  it("renaming a used team keeps award history pointing at it", async () => {
    const u = await createUnit({ teams: [{ name: "Đội A" }] });
    const team = u.teams[0];
    await insertAward(db, { subject: "TAP_THE", unitId: u.id, teamId: team?.id ?? 0 });
    const res = await put(u.id, { ...unitBody(), teams: [{ id: team?.id, name: "Tên mới" }] });
    expect(res.status).toBe(200);
    const row = await db
      .prepare("SELECT t.name FROM awards a JOIN teams t ON t.id = a.team_id WHERE a.unit_id = ?")
      .bind(u.id)
      .first<{ name: string }>();
    expect(row?.name).toBe("Tên mới");
  });

  it("blocks removing a used team with the exact message (BR-04)", async () => {
    const u = await createUnit({ teams: [{ name: "Đội A" }] });
    const team = u.teams[0];
    await insertOfficer(db, { id: 1, unitId: u.id, teamId: team?.id ?? 0 });
    await insertAward(db, { subject: "TAP_THE", unitId: u.id, teamId: team?.id ?? 0 });
    const res = await put(u.id, unitBody());
    expect(res.status).toBe(409);
    expect((await errorOf(res)).message).toBe(
      "Không thể xóa Đội A vì còn 1 cán bộ và 1 khen thưởng thuộc đội này",
    );
    expect(
      (await api(`/api/units/${u.id}`, { token }).then((r) => r.json())) as { teams: unknown[] },
    ).toHaveProperty("teams.length", 1);
  });

  it("a team referenced only by a soft-deleted officer still blocks removal", async () => {
    const u = await createUnit({ teams: [{ name: "Đội A" }] });
    await insertOfficer(db, {
      id: 1,
      unitId: u.id,
      teamId: u.teams[0]?.id ?? 0,
      deletedAt: "2026-01-01 00:00:00",
    });
    const res = await put(u.id, unitBody());
    expect(res.status).toBe(409);
    expect((await errorOf(res)).message).toBe(
      "Không thể xóa Đội A vì còn 1 cán bộ và 0 khen thưởng thuộc đội này (kể cả dữ liệu đã xóa, có thể khôi phục)",
    );
  });

  it("rejects a team id from another unit (400) and duplicate codes (409)", async () => {
    const u = await createUnit();
    const bad = await put(u.id, { ...unitBody(), teams: [{ id: SEED.teamP6Ct1, name: "Hack" }] });
    expect(bad.status).toBe(400);
    const dup = await put(u.id, unitBody({ code: "P1" }));
    expect(dup.status).toBe(409);
    expect((await put(9999, unitBody())).status).toBe(404);
  });
});

describe("DELETE /api/units/:id", () => {
  it("removes an empty unit with its teams and writes one audit row", async () => {
    const u = await createUnit({ teams: [{ name: "Đội A" }] });
    expect((await del(u.id)).status).toBe(200);
    const left = await db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM units WHERE id = ?) u, (SELECT COUNT(*) FROM teams WHERE unit_id = ?) t",
      )
      .bind(u.id, u.id)
      .first<{ u: number; t: number }>();
    expect(left).toEqual({ u: 0, t: 0 });
    expect(await auditCount("unit", "DELETE")).toBe(1);
  });

  it("is blocked with counts when officers or awards reference the unit", async () => {
    const u = await createUnit();
    await insertOfficer(db, { id: 1, unitId: u.id });
    await insertAward(db, { subject: "TAP_THE", unitId: u.id });
    const res = await del(u.id);
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { message: string; officer_count: number; award_count: number };
    };
    expect(body.error.message).toContain("Chưa thể xóa đơn vị");
    expect(body.error).toMatchObject({ officer_count: 1, award_count: 1 });
    expect(await auditCount("unit", "DELETE")).toBe(0);
  });

  it("is blocked when only soft-deleted officers reference the unit; unknown id is 404", async () => {
    const u = await createUnit();
    await insertOfficer(db, { id: 1, unitId: u.id, deletedAt: "2026-01-01 00:00:00" });
    const res = await del(u.id);
    expect(res.status).toBe(409);
    expect((await errorOf(res)).message).toBe(
      "Chưa thể xóa đơn vị: còn 1 cán bộ và 0 khen thưởng (kể cả dữ liệu đã xóa, có thể khôi phục)",
    );
    expect((await del(9999)).status).toBe(404);
  });
});
