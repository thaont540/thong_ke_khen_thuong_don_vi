import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  insertAward,
  insertOfficer,
  insertTeam,
  insertUnit,
  insertUser,
  resetTestData,
} from "./helpers/test-fixtures";

const db = env.DB;
const count = async (table: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

beforeEach(async () => {
  await resetTestData(db);
});

describe("delete unit/team guard (BR-04, decision: soft-deleted rows also block)", () => {
  beforeEach(async () => {
    await insertUnit(db, 900, "X1", "Đơn vị thử");
    await insertTeam(db, 900, 900, "X1-D1", "Đội thử");
  });

  it("empty unit deletes and cascades its teams", async () => {
    await db.prepare("DELETE FROM units WHERE id = 900").run();
    expect(await count("teams WHERE id = 900")).toBe(0);
  });

  it("team with officer blocks team and unit delete", async () => {
    await insertOfficer(db, { id: 1, unitId: 900, teamId: 900 });
    await expect(db.prepare("DELETE FROM teams WHERE id = 900").run()).rejects.toThrow(
      "Đội còn cán bộ hoặc khen thưởng",
    );
    await expect(db.prepare("DELETE FROM units WHERE id = 900").run()).rejects.toThrow(
      "Đơn vị còn cán bộ hoặc khen thưởng",
    );
  });

  it("team with award blocks delete", async () => {
    await insertAward(db, { subject: "TAP_THE", unitId: 900, teamId: 900 });
    await expect(db.prepare("DELETE FROM teams WHERE id = 900").run()).rejects.toThrow(
      "Đội còn cán bộ hoặc khen thưởng",
    );
  });

  it("soft-deleted officer still blocks", async () => {
    await insertOfficer(db, { id: 1, unitId: 900, deletedAt: "2026-01-01 00:00:00" });
    await expect(db.prepare("DELETE FROM units WHERE id = 900").run()).rejects.toThrow(
      "Đơn vị còn cán bộ hoặc khen thưởng",
    );
  });

  it("team can be deleted once empty while unit still has other data", async () => {
    await insertOfficer(db, { id: 1, unitId: 900 });
    await db.prepare("DELETE FROM teams WHERE id = 900").run();
    expect(await count("teams WHERE id = 900")).toBe(0);
  });
});

describe("partial unique badge (BR-06)", () => {
  it("duplicate active badge fails", async () => {
    await insertOfficer(db, { id: 1, badge: "123456" });
    await expect(insertOfficer(db, { id: 2, badge: "123456" })).rejects.toThrow(
      "UNIQUE constraint failed",
    );
  });

  it("badge of a soft-deleted officer can be reused", async () => {
    await insertOfficer(db, { id: 1, badge: "123456", deletedAt: "2026-01-01 00:00:00" });
    await insertOfficer(db, { id: 2, badge: "123456" });
    expect(await count("officers")).toBe(2);
  });

  it("badge must be 6 digits", async () => {
    await expect(insertOfficer(db, { id: 1, badge: "12345" })).rejects.toThrow();
    await expect(insertOfficer(db, { id: 2, badge: "12345a" })).rejects.toThrow();
  });
});

describe("users", () => {
  it("username unique ignoring ASCII case, length 3-32", async () => {
    await insertUser(db, { id: 1, username: "Admin" });
    await expect(insertUser(db, { id: 2, username: "admin" })).rejects.toThrow(
      "UNIQUE constraint failed",
    );
    await expect(insertUser(db, { id: 3, username: "ab" })).rejects.toThrow();
  });
});
