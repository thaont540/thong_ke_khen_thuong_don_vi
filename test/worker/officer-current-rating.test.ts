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

describe("officer current_rating (derived from XEP_LOAI awards)", () => {
  it("current_rating is the latest-year non-deleted XEP_LOAI award; list and detail agree", async () => {
    const created = (await (await post(body({ joined_month: "2012-09" }))).json()) as {
      id: number;
    };
    await insertAward(db, {
      id: 1,
      officerId: created.id,
      awardTypeId: SEED.typeXepLoaiHt,
      year: 2023,
    });
    await insertAward(db, {
      id: 2,
      officerId: created.id,
      awardTypeId: SEED.typeXepLoaiTot,
      year: 2025,
    });
    await insertAward(db, {
      id: 3,
      officerId: created.id,
      awardTypeId: SEED.typeXepLoaiXs,
      year: 2026,
    });
    await insertAward(db, {
      id: 4,
      officerId: created.id,
      awardTypeId: SEED.typeCstdCoSo,
      year: 2026,
    });
    const expected = { name: "Hoàn thành xuất sắc nhiệm vụ", year: 2026 };
    const detail = officerDetailSchema.parse(
      await (await api(`/api/officers/${created.id}`, { token })).json(),
    );
    expect(detail.current_rating).toEqual(expected);
    expect(detail.awards).toHaveLength(4); // ratings are part of the history
    const list = (await (await api("/api/officers", { token })).json()) as {
      items: { current_rating: unknown }[];
    };
    expect(list.items[0]?.current_rating).toEqual(expected);

    // Deleting the latest rating falls back to the previous year; the CSTD award never counts.
    await db.prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = 3").run();
    const after = (await (await api(`/api/officers/${created.id}`, { token })).json()) as {
      current_rating: unknown;
    };
    expect(after.current_rating).toEqual({ name: "Hoàn thành tốt nhiệm vụ", year: 2025 });
  });

  it("list resolves each officer's own rating without per-row requests (one page, mixed)", async () => {
    await insertOfficer(db, { id: 1, badge: "100001" });
    await insertOfficer(db, { id: 2, badge: "100002" });
    await insertOfficer(db, { id: 3, badge: "100003" });
    await insertAward(db, { id: 1, officerId: 1, awardTypeId: SEED.typeXepLoaiXs, year: 2024 });
    await insertAward(db, { id: 2, officerId: 2, awardTypeId: SEED.typeXepLoaiHt, year: 2025 });
    const { items } = (await (await api("/api/officers", { token })).json()) as {
      items: { id: number; current_rating: { name: string; year: number } | null }[];
    };
    const byId = new Map(items.map((o) => [o.id, o.current_rating]));
    expect(byId.get(1)).toEqual({ name: "Hoàn thành xuất sắc nhiệm vụ", year: 2024 });
    expect(byId.get(2)).toEqual({ name: "Hoàn thành nhiệm vụ", year: 2025 });
    expect(byId.get(3)).toBeNull();
  });
});
