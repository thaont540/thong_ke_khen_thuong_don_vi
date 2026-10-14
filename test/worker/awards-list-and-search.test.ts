import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { awardListResponseSchema } from "../../src/shared/schemas/award-schemas";
import { insertOfficer, seedAward, send, setupAwardTest } from "./helpers/award-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let viewer: string;

beforeEach(async () => {
  ({ viewer } = await setupAwardTest());
  await insertOfficer(env.DB, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(env.DB, { id: 2, unitId: 7, teamId: SEED.teamP7Dd1 });
  await env.DB.prepare(
    "UPDATE officers SET full_name = 'Nguyễn Văn Ân', full_name_search = 'nguyễn văn ân' WHERE id = 1",
  ).run();
});

const list = async (qs = "") => {
  const res = await send(viewer, "GET", `/api/awards${qs}`);
  expect(res.status).toBe(200);
  return awardListResponseSchema.parse(await res.json());
};
const ids = (r: { items: { id: number }[] }) => r.items.map((i) => i.id);

async function seedMix() {
  return {
    personalP6: await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: SEED.typeCstdCoSo,
      year: 2025,
      decision: "125/QĐ-ĐV",
    }),
    personalP7: await seedAward({
      subject: "CA_NHAN",
      officerId: 2,
      unitId: 7,
      teamId: SEED.teamP7Dd1,
      typeId: SEED.typeGiayKhen,
      year: 2026,
      decision: "9/GK",
    }),
    unitLevel: await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      typeId: SEED.typeDvTienTien,
      year: 2026,
      decision: "10/QĐ",
    }),
    teamLevel: await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: 3,
      year: 2024,
      decision: "11/QĐ",
    }),
    deleted: await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      typeId: SEED.typeDvTienTien,
      deleted: true,
    }),
  };
}

describe("GET /api/awards filters, stats, order", () => {
  it("orders year desc then newest id; excludes soft-deleted; stats cover the filtered set", async () => {
    const s = await seedMix();
    const r = await list();
    expect(ids(r)).toEqual([s.unitLevel, s.personalP7, s.personalP6, s.teamLevel]);
    expect(r).toMatchObject({
      total: 4,
      page: 1,
      size: 10,
      stats: { total: 4, danh_hieu: 3, khen_thuong: 1, tap_the: 2, ca_nhan: 2 },
    });
  });

  it("each filter and combinations; empty-string params mean no filter", async () => {
    const s = await seedMix();
    expect(ids(await list(`?unit_id=7`))).toEqual([s.personalP7]);
    expect(ids(await list(`?team_id=${SEED.teamP6Ct1}`)).sort()).toEqual(
      [s.personalP6, s.teamLevel].sort(),
    );
    expect(ids(await list(`?subject=TAP_THE`))).toEqual([s.unitLevel, s.teamLevel]);
    expect(ids(await list(`?form=KHEN_THUONG`))).toEqual([s.personalP7]);
    expect(ids(await list(`?unit_id=${SEED.unitP6}&subject=CA_NHAN&form=DANH_HIEU`))).toEqual([
      s.personalP6,
    ]);
    expect((await list(`?unit_id=&team_id=&subject=&form=&q=`)).total).toBe(4);
    const filtered = await list(`?subject=TAP_THE`);
    expect(filtered.stats).toMatchObject({ total: 2, tap_the: 2, ca_nhan: 0 });
  });

  it("empty result has zeroed stats (no NULL sums)", async () => {
    const r = await list("?unit_id=10");
    expect(r).toMatchObject({
      items: [],
      total: 0,
      stats: { total: 0, danh_hieu: 0, khen_thuong: 0, tap_the: 0, ca_nhan: 0 },
    });
  });

  it("paginates: page 2 holds the rest, size is capped by validation", async () => {
    for (let i = 0; i < 12; i++) {
      await seedAward({
        subject: "TAP_THE",
        unitId: SEED.unitP1,
        typeId: SEED.typeDvTienTien,
        year: 2000 + i,
      });
    }
    const p2 = await list("?page=2");
    expect(p2.items).toHaveLength(2);
    expect(p2).toMatchObject({ total: 12, page: 2 });
    expect((await send(viewer, "GET", "/api/awards?size=51")).status).toBe(400);
  });

  it("returns display fields", async () => {
    await seedMix();
    const personal = (await list("?subject=CA_NHAN&unit_id=6")).items[0];
    expect(personal).toMatchObject({
      officer_name: "Nguyễn Văn Ân",
      officer_rank_name: "Đại úy",
      unit_name: "Phòng 6",
      authority_name: "Thủ trưởng đơn vị",
      award_type_name: "Chiến sĩ thi đua cơ sở",
      form: "DANH_HIEU",
    });
  });
});

describe("GET /api/awards q search (BR-07)", () => {
  it("matches officer name ignoring case, extra spaces and decomposed (NFD) input", async () => {
    const s = await seedMix();
    for (const q of ["NGUYỄN văn", "  nguyễn   văn  ân ", "Nguyễn".normalize("NFD"), "văn ân"]) {
      expect(ids(await list(`?q=${encodeURIComponent(q)}`))).toEqual([s.personalP6]);
    }
  });

  it("matches decision number case-insensitively ('qđ' vs 'QĐ')", async () => {
    const s = await seedMix();
    expect(ids(await list("?q=" + encodeURIComponent("125/qđ")))).toEqual([s.personalP6]);
    expect(ids(await list("?q=" + encodeURIComponent("QĐ")))).toEqual([
      s.unitLevel,
      s.personalP6,
      s.teamLevel,
    ]);
  });

  it("collective: team name matches team awards; unit name matches unit-level awards only", async () => {
    const s = await seedMix();
    expect(ids(await list("?q=" + encodeURIComponent("cao tốc số 1")))).toEqual([s.teamLevel]);
    // "Phòng 6" matches the unit-level collective award, not the team-level one or personal awards
    expect(ids(await list("?q=" + encodeURIComponent("phòng 6")))).toEqual([s.unitLevel]);
  });

  it("% and _ are literal characters", async () => {
    await seedMix();
    expect((await list("?q=%25")).total).toBe(0);
    expect((await list("?q=_")).total).toBe(0);
    const s = await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP1,
      typeId: SEED.typeDvTienTien,
      decision: "50%/QĐ_1",
    });
    expect(ids(await list("?q=50%25"))).toEqual([s]);
    expect(ids(await list("?q=%25%2Fqđ_1"))).toEqual([s]);
  });

  it("combines with filters and keeps stats consistent", async () => {
    const s = await seedMix();
    const r = await list("?q=qđ&subject=TAP_THE");
    expect(ids(r)).toEqual([s.unitLevel, s.teamLevel]);
    expect(r.stats.total).toBe(2);
  });
});
