import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { vnYearMonth } from "../../src/shared/officer-seniority";
import { officerDetailSchema } from "../../src/shared/schemas/officer-schemas";
import { api, createSession, errorOf } from "./helpers/auth-helpers";
import { insertUser, resetTestData, SEED } from "./helpers/test-fixtures";

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

describe("officer joined_month / rating_id", () => {
  it("are optional: omitted -> null, rating_name null", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      joined_month: null,
      rating_id: null,
      rating_name: null,
    });
  });

  it("create returns the values and rating name; list and detail expose them too", async () => {
    const res = await post(body({ joined_month: "2012-09", rating_id: 2 }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    expect(created).toMatchObject({
      joined_month: "2012-09",
      rating_id: 2,
      rating_name: "Hoàn thành tốt nhiệm vụ",
    });
    const list = (await (await api("/api/officers", { token })).json()) as {
      items: Record<string, unknown>[];
    };
    expect(list.items[0]).toMatchObject({
      joined_month: "2012-09",
      rating_name: "Hoàn thành tốt nhiệm vụ",
    });
    const detail = officerDetailSchema.parse(
      await (await api(`/api/officers/${created.id}`, { token })).json(),
    );
    expect(detail).toMatchObject({ joined_month: "2012-09", rating_id: 2 });
    expect(detail.rating_name).toBe("Hoàn thành tốt nhiệm vụ");
  });

  it("update sets and clears the fields; audit before/after contain them", async () => {
    const created = (await (await post(body())).json()) as { id: number };
    const set = await put(created.id, body({ joined_month: "2015-06", rating_id: 1 }));
    expect(await set.json()).toMatchObject({ joined_month: "2015-06", rating_id: 1 });
    const clear = await put(created.id, body({ joined_month: null, rating_id: null }));
    expect(await clear.json()).toMatchObject({ joined_month: null, rating_name: null });
    const { results } = await db
      .prepare(
        "SELECT detail FROM audit_logs WHERE action = 'UPDATE' AND entity = 'officer' ORDER BY id",
      )
      .all<{ detail: string }>();
    expect(JSON.parse(results[0]?.detail ?? "{}")).toEqual({
      before: { joined_month: null, rating_id: null },
      after: { joined_month: "2015-06", rating_id: 1 },
    });
    expect(JSON.parse(results[1]?.detail ?? "{}")).toEqual({
      before: { joined_month: "2015-06", rating_id: 1 },
      after: { joined_month: null, rating_id: null },
    });
  });

  it("create audit records the new fields", async () => {
    await post(body({ joined_month: "2012-09", rating_id: 3 }));
    const row = await db
      .prepare("SELECT detail FROM audit_logs WHERE action = 'CREATE' AND entity = 'officer'")
      .first<{ detail: string }>();
    expect(JSON.parse(row?.detail ?? "{}").after).toMatchObject({
      joined_month: "2012-09",
      rating_id: 3,
    });
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

  it("rejects unknown and inactive ratings with a field error", async () => {
    const unknown = await post(body({ rating_id: 999 }));
    expect(unknown.status).toBe(400);
    expect((await errorOf(unknown)).fields?.rating_id).toBe("Xếp loại không hợp lệ");
    await db.prepare("UPDATE officer_ratings SET is_active = 0 WHERE id = 4").run();
    const inactive = await post(body({ rating_id: 4 }));
    expect(inactive.status).toBe(400);
    expect((await errorOf(inactive)).fields?.rating_id).toBe("Xếp loại không hợp lệ");
    const created = (await (await post(body())).json()) as { id: number };
    expect((await put(created.id, body({ rating_id: 4 }))).status).toBe(400);
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

  it("DB foreign key rejects an unknown rating_id", async () => {
    await expect(
      db
        .prepare(
          `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                                 rank_id, position_id, unit_id, rating_id)
           VALUES (1, 'CB001', 'A', 'a', 1990, '123456', 7, 7, 6, 999)`,
        )
        .run(),
    ).rejects.toThrow();
  });
});
