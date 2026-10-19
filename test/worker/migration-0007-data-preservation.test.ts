import { env } from "cloudflare:workers";
import { afterAll, describe, expect, it } from "vitest";

const db = env.DB;
const MIGRATIONS = env.TEST_MIGRATIONS;

/** Drops every table/trigger/index (except D1 internals) in one deferred-FK batch. */
async function dropAll() {
  const { results } = await db
    .prepare(
      `SELECT type, name FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND type IN ('table','trigger','view')`,
    )
    .all<{ type: string; name: string }>();
  await db.batch([
    db.prepare("PRAGMA defer_foreign_keys = ON"),
    ...results
      .filter((r) => r.type !== "table" || r.name !== "d1_migrations")
      .map((r) => db.prepare(`DROP ${r.type.toUpperCase()} IF EXISTS "${r.name}"`)),
  ]);
}

async function apply(names: (name: string) => boolean) {
  for (const m of MIGRATIONS.filter((x) => names(x.name))) {
    await db.batch(m.queries.map((q) => db.prepare(q)));
  }
}

const is0007 = (n: string) => n.startsWith("0007_");
const n = async (sql: string) =>
  ((await db.prepare(sql).first<{ n: number }>()) as { n: number }).n;

afterAll(async () => {
  // Leave the file's DB in the fully migrated state.
  await dropAll();
  await apply(() => true);
});

describe("migration 0007 on a database that already holds data", () => {
  it("preserves ids/rows, children, counters, triggers and indexes; applies new rules", async () => {
    await dropAll();
    await apply((name) => name < "0007");

    // Pre-0007 data: a team-bearing unit, an officer with team + deprecated rating, badge, awards.
    await db.batch([
      db.prepare("INSERT INTO units (id, code, name, kind) VALUES (50, 'PX', 'Phòng X', 'PHONG')"),
      db.prepare("INSERT INTO teams (id, unit_id, code, name) VALUES (60, 50, 'PX-1', 'Đội X1')"),
      db.prepare(
        `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
            rank_id, position_id, unit_id, team_id, joined_month, rating_id)
         VALUES (1, 'CB001', 'Nguyễn Văn An', 'nguyen van an', 1990, '123456', 7, 7, 50, 60, '2015-06', 2),
                (2, 'CB002', 'Trần Bình', 'tran binh', 1985, '654321', 8, 7, 6, NULL, NULL, NULL)`,
      ),
      db.prepare(
        `INSERT INTO awards (id, subject, officer_id, unit_id, team_id, award_type_id, award_variant_id, year,
            decision_number, decision_number_search, decision_date, authority_id, achievement)
         VALUES (1, 'CA_NHAN', 1, 50, 60, 7, NULL, 2025, '1/QĐ', '1/qđ', '2025-01-01', 4, 'a'),
                (2, 'CA_NHAN', 2, 6, NULL, 9, 3, 2024, '2/QĐ', '2/qđ', '2024-01-01', 1, 'b'),
                (3, 'TAP_THE', NULL, 50, 60, 4, NULL, 2025, '3/QĐ', '3/qđ', '2025-01-01', 4, 'c')`,
      ),
    ]);
    const before = {
      units: await n("SELECT COUNT(*) n FROM units"),
      teams: await n("SELECT COUNT(*) n FROM teams"),
      types: await n("SELECT COUNT(*) n FROM award_types"),
      variants: await n("SELECT COUNT(*) n FROM award_variants"),
    };
    const countersBefore = (await db.prepare("SELECT * FROM award_counters ORDER BY 1,2,3,4").all())
      .results;

    await apply(is0007);

    // Rows and ids preserved (new catalog rows are extra).
    expect(await n("SELECT COUNT(*) n FROM units")).toBe(before.units + 1);
    expect(await n("SELECT COUNT(*) n FROM teams")).toBe(before.teams);
    expect(await n("SELECT COUNT(*) n FROM award_types")).toBe(before.types + 4);
    expect(await n("SELECT COUNT(*) n FROM award_variants")).toBe(before.variants);
    expect(await db.prepare("SELECT * FROM units WHERE id = 50").first()).toMatchObject({
      code: "PX",
      kind: "PHONG",
    });
    expect(await db.prepare("SELECT unit_id FROM teams WHERE id = 60").first()).toEqual({
      unit_id: 50,
    });
    expect(await db.prepare("SELECT * FROM officers WHERE id = 1").first()).toMatchObject({
      code: "CB001",
      full_name: "Nguyễn Văn An",
      birth_year: 1990,
      badge_number: "123456",
      unit_id: 50,
      team_id: 60,
      joined_month: "2015-06",
      rating_id: 2,
    });
    expect(await n("SELECT COUNT(*) n FROM awards")).toBe(3);
    expect(
      await db.prepare("SELECT award_type_id, award_variant_id FROM awards WHERE id = 2").first(),
    ).toEqual({
      award_type_id: 9,
      award_variant_id: 3,
    });
    expect(
      (await db.prepare("SELECT * FROM award_counters ORDER BY 1,2,3,4").all()).results,
    ).toEqual(countersBefore);
    expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);

    // Triggers and indexes of the rebuilt tables are back.
    const names = (
      await db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('trigger','index')")
        .all<{ name: string }>()
    ).results.map((r) => r.name);
    for (const expected of [
      "trg_officers_team_ins",
      "trg_officers_team_upd",
      "trg_units_no_delete_used",
      "trg_teams_no_delete_used",
      "trg_awards_check_ins",
      "trg_awards_check_upd",
      "trg_awards_xep_loai_ins",
      "trg_awards_xep_loai_upd",
      "trg_award_counters_ins",
      "ux_officers_badge",
      "ix_officers_unit_team",
    ]) {
      expect(names).toContain(expected);
    }

    // Existing behavior still enforced after the rebuild.
    await expect(
      db
        .prepare("INSERT INTO teams (id, unit_id, code, name) VALUES (61, 6, 'PX-9', 'Đội 9')")
        .run(),
    ).resolves.toBeTruthy();
    await expect(db.prepare("DELETE FROM units WHERE id = 50").run()).rejects.toThrow(
      "Đơn vị còn cán bộ hoặc khen thưởng",
    );
    await expect(db.prepare("UPDATE officers SET team_id = 61 WHERE id = 1").run()).rejects.toThrow(
      "Đội không thuộc đơn vị của cán bộ",
    );
    await expect(
      db.prepare("UPDATE officers SET badge_number = '654321' WHERE id = 1").run(),
    ).rejects.toThrow();

    // New rules: CUC unit kind, nullable badge/birth year (several NULL badges), XEP_LOAI form + trigger.
    expect(
      await db.prepare("SELECT code, kind, sort_order FROM units WHERE code = 'C08'").first(),
    ).toEqual({
      code: "C08",
      kind: "CUC",
      sort_order: 0,
    });
    await db
      .prepare("UPDATE officers SET badge_number = NULL, birth_year = NULL WHERE id IN (1, 2)")
      .run();
    await expect(
      db.prepare("UPDATE officers SET badge_number = '12' WHERE id = 1").run(),
    ).rejects.toThrow();
    const xl = await n("SELECT id AS n FROM award_types WHERE code = 'XL_HTXSNV'");
    const insertRating = (year: number) =>
      db
        .prepare(
          `INSERT INTO awards (subject, officer_id, unit_id, award_type_id, year, decision_number,
             decision_number_search, decision_date, authority_id, achievement)
           VALUES ('CA_NHAN', 1, 50, ?, ?, 'x', 'x', '2025-01-01', 5, 'x')`,
        )
        .bind(xl, year);
    await insertRating(2025).run();
    await expect(insertRating(2025).run()).rejects.toThrow("Cán bộ đã có xếp loại năm này");
    await insertRating(2026).run();
  });
});
