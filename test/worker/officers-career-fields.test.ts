import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { vnYearMonth } from "../../src/shared/officer-seniority";
import { officerDetailSchema } from "../../src/shared/schemas/officer-schemas";
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
  await insertUser(db, { id: 1, username: "admin1" });
  await db.prepare("UPDATE users SET must_change_password = 0").run();
  token = await createSession(db, 1);
});

const body = (over: Record<string, unknown> = {}) => ({
  full_name: "Nguyễn Văn An",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: SEED.rankDaiUy,
  position_id: SEED.positionCanBo,
  unit_id: SEED.unitP6,
  team_id: null,
  ...over,
});
const post = (b: unknown) => api("/api/officers", { method: "POST", token, body: b });
const put = (id: number, b: unknown) =>
  api(`/api/officers/${id}`, { method: "PUT", token, body: b });
const nextMonth = () => {
  const { year, month } = vnYearMonth();
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
};

describe("officer joined_month / optional birth year, badge / derived current_rating", () => {
  it("joined_month is optional: omitted -> null; current_rating null without a rating record", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({ joined_month: null, current_rating: null });
    expect(json).not.toHaveProperty("rating_id");
  });

  it("birth_year and badge_number must be sent but may be null; several officers without badge coexist", async () => {
    const { birth_year: _y, badge_number: _b, ...bare } = body();
    expect((await post({ ...bare, full_name: "Thiếu khóa" })).status).toBe(400);
    const nulls = { ...bare, birth_year: null, badge_number: null };
    const first = await post({ ...nulls, full_name: "Người Một" });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ birth_year: null, badge_number: null });
    const second = await post({ ...nulls, full_name: "Người Hai" });
    expect(second.status).toBe(201);
    const { items } = (await (await api("/api/officers", { token })).json()) as {
      items: { badge_number: string | null }[];
    };
    expect(items.map((o) => o.badge_number)).toEqual([null, null]);
    // A real badge still has to be unique, and a malformed one is rejected.
    expect((await post(body({ badge_number: "123456" }))).status).toBe(201);
    expect((await post(body({ badge_number: "123456" }))).status).toBe(409);
    expect((await post(body({ badge_number: "12" }))).status).toBe(400);
  });

  it("update can clear birth_year and badge_number, and the badge is then free again", async () => {
    const created = (await (await post(body())).json()) as { id: number };
    const cleared = await put(created.id, body({ birth_year: null, badge_number: null }));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ birth_year: null, badge_number: null });
    expect((await post(body({ badge_number: "123456" }))).status).toBe(201);
  });

  it("PUT omitting birth_year/badge_number is a 400 and keeps the stored values", async () => {
    const created = (await (await post(body())).json()) as { id: number };
    const { birth_year: _y, badge_number: _b, ...partial } = body({ full_name: "Đổi tên" });
    expect((await put(created.id, partial)).status).toBe(400);
    expect((await put(created.id, { ...partial, birth_year: 1990 })).status).toBe(400);
    const detail = await (await api(`/api/officers/${created.id}`, { token })).json();
    expect(detail).toMatchObject({
      full_name: "Nguyễn Văn An",
      birth_year: 1990,
      badge_number: "123456",
    });
  });

  it("update sets and clears joined_month; audit before/after contain it (no rating_id)", async () => {
    const created = (await (await post(body())).json()) as { id: number };
    const set = await put(created.id, body({ joined_month: "2015-06" }));
    expect(await set.json()).toMatchObject({ joined_month: "2015-06" });
    const clear = await put(created.id, body({ joined_month: null }));
    expect(await clear.json()).toMatchObject({ joined_month: null });
    const { results } = await db
      .prepare(
        "SELECT detail FROM audit_logs WHERE action = 'UPDATE' AND entity = 'officer' ORDER BY id",
      )
      .all<{ detail: string }>();
    expect(JSON.parse(results[0]?.detail ?? "{}")).toEqual({
      before: { joined_month: null },
      after: { joined_month: "2015-06" },
    });
    expect(JSON.parse(results[1]?.detail ?? "{}")).toEqual({
      before: { joined_month: "2015-06" },
      after: { joined_month: null },
    });
  });

  it("create audit records joined_month", async () => {
    await post(body({ joined_month: "2012-09" }));
    const row = await db
      .prepare("SELECT detail FROM audit_logs WHERE action = 'CREATE' AND entity = 'officer'")
      .first<{ detail: string }>();
    expect(JSON.parse(row?.detail ?? "{}").after).toMatchObject({ joined_month: "2012-09" });
  });

  it("rejects a future month, month before birth year + 16, and a malformed month with 400", async () => {
    const future = await post(body({ joined_month: nextMonth() }));
    expect(future.status).toBe(400);
    expect((await errorOf(future)).fields?.joined_month).toBe(
      "Tháng năm vào ngành không được ở tương lai",
    );
    const young = await post(body({ joined_month: "2005-12" }));
    expect(young.status).toBe(400);
    expect((await errorOf(young)).fields?.joined_month).toBe(
      "Tháng năm vào ngành phải sau năm sinh ít nhất 16 năm",
    );
    expect((await post(body({ joined_month: "2015-13" }))).status).toBe(400);
    expect((await post(body({ joined_month: "06/2015" }))).status).toBe(400);
  });

  it("accepts the current VN month and exactly birth year + 16", async () => {
    const { year, month } = vnYearMonth();
    const current = `${year}-${String(month).padStart(2, "0")}`;
    expect((await post(body({ joined_month: current, badge_number: "111111" }))).status).toBe(201);
    expect((await post(body({ joined_month: "2006-01", badge_number: "222222" }))).status).toBe(
      201,
    );
  });

  it("DB CHECK rejects invalid joined_month text", async () => {
    for (const bad of ["2015-13", "2015-00", "2015/06", "15-06-01"]) {
      await expect(
        db
          .prepare(
            `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                                   rank_id, position_id, unit_id, joined_month)
             VALUES (1, 'CB001', 'A', 'a', 1990, '123456', 7, 7, 6, ?)`,
          )
          .bind(bad)
          .run(),
      ).rejects.toThrow();
    }
  });
});
