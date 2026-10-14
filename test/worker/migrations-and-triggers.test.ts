import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { insertAward, insertOfficer, resetTestData, SEED } from "./helpers/test-fixtures";

const db = env.DB;
const count = async (table: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

beforeEach(async () => {
  await resetTestData(db);
});

describe("seed counts (§8)", () => {
  it("master data rows", async () => {
    expect(
      await Promise.all(
        [
          "units",
          "teams",
          "ranks",
          "positions",
          "authorities",
          "award_types",
          "award_variants",
        ].map(count),
      ),
    ).toEqual([10, 13, 15, 7, 4, 12, 6]);
  });

  it("all triggers and partial indexes exist", async () => {
    const { results } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type IN ('trigger','index') AND name NOT LIKE 'sqlite_%'",
      )
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const n of [
      "trg_officers_team_ins",
      "trg_officers_team_upd",
      "trg_awards_check_ins",
      "trg_awards_check_upd",
      "trg_units_no_delete_used",
      "trg_teams_no_delete_used",
      "ux_officers_badge",
      "ix_officers_unit_team",
      "ix_awards_list",
      "ix_awards_unit_team",
      "ix_awards_officer",
      "ix_awards_type",
      "ix_awards_decision",
      "trg_import_batches_row_cap",
      "ix_awards_import_batch",
    ])
      expect(names).toContain(n);
  });
});

describe("team must belong to unit (BR-01)", () => {
  it("officer insert with foreign team aborts", async () => {
    await expect(
      insertOfficer(db, { id: 1, unitId: SEED.unitP1, teamId: SEED.teamP6Ct1 }),
    ).rejects.toThrow("Đội không thuộc đơn vị của cán bộ");
  });

  it("officer update to foreign team aborts; valid team ok", async () => {
    await insertOfficer(db, { id: 1, unitId: SEED.unitP6 });
    await db.prepare("UPDATE officers SET team_id = ? WHERE id = 1").bind(SEED.teamP6Ct1).run();
    await expect(
      db.prepare("UPDATE officers SET team_id = ? WHERE id = 1").bind(SEED.teamP7Dd1).run(),
    ).rejects.toThrow("Đội không thuộc đơn vị của cán bộ");
  });

  it("award insert with foreign team aborts", async () => {
    await expect(
      insertAward(db, { subject: "TAP_THE", unitId: SEED.unitP1, teamId: SEED.teamP6Ct1 }),
    ).rejects.toThrow("Đội không thuộc đơn vị");
  });

  it("award update to foreign team aborts", async () => {
    await insertAward(db, {
      id: 1,
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
    });
    await expect(
      db.prepare("UPDATE awards SET team_id = ? WHERE id = 1").bind(SEED.teamP7Dd1).run(),
    ).rejects.toThrow("Đội không thuộc đơn vị");
  });
});

describe("award type rules (spec §7 triggers)", () => {
  it("subject_scope violation: collective award with individual-only type", async () => {
    await expect(
      insertAward(db, { subject: "TAP_THE", awardTypeId: SEED.typeCstdCoSo }),
    ).rejects.toThrow("Danh hiệu / khen thưởng không áp dụng cho đối tượng này");
  });

  it("subject_scope violation on update", async () => {
    await insertAward(db, { id: 1, subject: "TAP_THE" });
    await expect(
      db.prepare("UPDATE awards SET award_type_id = ? WHERE id = 1").bind(SEED.typeCstdCoSo).run(),
    ).rejects.toThrow("Danh hiệu / khen thưởng không áp dụng cho đối tượng này");
  });

  it("Huân chương requires a variant", async () => {
    await expect(
      insertAward(db, { subject: "TAP_THE", awardTypeId: SEED.typeHuanChuong }),
    ).rejects.toThrow("Cần chọn loại cho hình thức khen thưởng này");
  });

  it("variant must belong to the chosen type", async () => {
    await expect(
      insertAward(db, {
        subject: "TAP_THE",
        awardTypeId: SEED.typeGiayKhen,
        variantId: SEED.variantHcBvtq1,
      }),
    ).rejects.toThrow("Loại không thuộc hình thức khen thưởng đã chọn");
  });

  it("valid Huân chương + variant for both subjects", async () => {
    await insertOfficer(db, { id: 1 });
    await insertAward(db, {
      subject: "TAP_THE",
      awardTypeId: SEED.typeHuanChuong,
      variantId: SEED.variantHcBvtq1,
    });
    await insertAward(db, {
      officerId: 1,
      awardTypeId: SEED.typeHuanChuong,
      variantId: SEED.variantHcBvtq1,
    });
    expect(await count("awards")).toBe(2);
  });

  it("CHECK: individual award needs officer", async () => {
    await expect(insertAward(db, { subject: "CA_NHAN", officerId: null })).rejects.toThrow();
  });
});
