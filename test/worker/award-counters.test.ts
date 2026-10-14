import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import driftSql from "../../scripts/check-award-counter-drift.sql?raw";
import recomputeSql from "../../scripts/recompute-award-counters.sql?raw";
import { listAwards } from "../../src/worker/services/awards-list-query-service";
import { insertAward, insertOfficer, resetTestData, SEED } from "./helpers/test-fixtures";

const db = env.DB;
const live = () =>
  db
    .prepare(
      `SELECT unit_id, COALESCE(team_id, 0) AS team_id, award_type_id, subject, COUNT(*) AS n
       FROM awards WHERE deleted_at IS NULL GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`,
    )
    .all();
const counters = () =>
  db
    .prepare(
      `SELECT unit_id, team_id, award_type_id, subject, n FROM award_counters
       WHERE n > 0 ORDER BY 1, 2, 3, 4`,
    )
    .all();

beforeEach(async () => {
  await resetTestData(db);
  await insertOfficer(db, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(db, { id: 2, unitId: SEED.unitP1 });
});

describe("award_counters stay equal to a live GROUP BY (trigger maintenance)", () => {
  it("insert, edit, soft-delete, restore and hard delete", async () => {
    await insertAward(db, { id: 1, officerId: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
    await insertAward(db, { id: 2, officerId: 2, unitId: SEED.unitP1 });
    await insertAward(db, { id: 3, subject: "TAP_THE", unitId: SEED.unitP6 });
    expect((await counters()).results).toEqual((await live()).results);

    await db
      .prepare("UPDATE awards SET unit_id = ?, team_id = NULL, officer_id = 2 WHERE id = 1")
      .bind(SEED.unitP1)
      .run();
    expect((await counters()).results).toEqual((await live()).results);

    await db.prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = 2").run();
    expect((await counters()).results).toEqual((await live()).results);

    await db.prepare("UPDATE awards SET deleted_at = NULL WHERE id = 2").run();
    expect((await counters()).results).toEqual((await live()).results);

    await db
      .prepare("UPDATE awards SET award_type_id = ? WHERE id = 3")
      .bind(SEED.typeDvTienTien)
      .run();
    await db.prepare("DELETE FROM awards WHERE id = 1").run();
    await db.prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = 3").run();
    await db.prepare("DELETE FROM awards WHERE id = 3").run(); // already inactive: no double decrement
    expect((await counters()).results).toEqual((await live()).results);
  });

  it("F01 stats from counters equal the live scan for every filter combination", async () => {
    await insertAward(db, { id: 1, officerId: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
    await insertAward(db, {
      id: 2,
      officerId: 2,
      unitId: SEED.unitP1,
      awardTypeId: SEED.typeGiayKhen,
    });
    await insertAward(db, { id: 3, subject: "TAP_THE", unitId: SEED.unitP6 });
    await insertAward(db, { id: 4, officerId: 2, unitId: SEED.unitP1 });
    await db.prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = 4").run();
    const filters = [
      {},
      { unit_id: SEED.unitP6 },
      { unit_id: SEED.unitP6, team_id: SEED.teamP6Ct1 },
      { subject: "TAP_THE" as const },
      { form: "KHEN_THUONG" as const },
      { unit_id: SEED.unitP1, subject: "CA_NHAN" as const, form: "KHEN_THUONG" as const },
    ];
    for (const f of filters) {
      const viaCounters = await listAwards(db, { page: 1, size: 10, ...f });
      // A q matching every row (all fixtures share decision 125/QĐ-ĐV) takes the live-scan path.
      const viaScan = await listAwards(db, { page: 1, size: 10, ...f, q: "125/" });
      expect(viaCounters.stats).toEqual(viaScan.stats);
      expect(viaCounters.total).toBe(viaScan.total);
    }
  });
});

describe("counter drift check and recompute scripts", () => {
  const drift = async () => (await db.prepare(driftSql).all()).results;
  const statements = (sql: string) =>
    sql
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n")
      .split(";")
      .map((q) => q.trim())
      .filter(Boolean);

  it("reports no drift when healthy, detects wrong/missing/stale rows, and recompute repairs them", async () => {
    await insertAward(db, { id: 1, officerId: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
    await insertAward(db, { id: 2, officerId: 2, unitId: SEED.unitP1 });
    expect(await drift()).toEqual([]);

    await db
      .prepare("UPDATE award_counters SET n = n + 5 WHERE unit_id = ?")
      .bind(SEED.unitP1)
      .run();
    await db.prepare("DELETE FROM award_counters WHERE unit_id = ?").bind(SEED.unitP6).run();
    await db.prepare("INSERT INTO award_counters VALUES (9, 0, 7, 'CA_NHAN', 3)").run();
    const found = await drift();
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.map((r) => r.unit_id)).toEqual(
      expect.arrayContaining([SEED.unitP1, SEED.unitP6, 9]),
    );

    await db.batch(statements(recomputeSql).map((q) => db.prepare(q)));
    expect(await drift()).toEqual([]);
    expect((await counters()).results).toEqual((await live()).results);
  });
});
