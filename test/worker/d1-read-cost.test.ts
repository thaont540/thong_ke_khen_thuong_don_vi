import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAwards } from "../../src/worker/services/awards-list-query-service";
import { getOfficerDetail } from "../../src/worker/services/officer-lookup-service";
import { listOfficers } from "../../src/worker/services/officers-service";
import { listUnits } from "../../src/worker/services/units-query-service";
import { meterD1, type ReadMeter } from "./helpers/d1-read-meter";
import { resetTestData } from "./helpers/test-fixtures";

const AWARDS = 50_000;
const OFFICERS = 2_000;
let meter: ReadMeter;

/** Seeds with recursive CTEs (triggers still run). 20% collective at unit level, 80% personal. */
beforeAll(async () => {
  await resetTestData(env.DB);
  await env.DB.prepare(
    `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                           rank_id, position_id, unit_id, team_id)
     WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${OFFICERS})
     SELECT i, 'CB' || printf('%05d', i), 'Cán bộ ' || i, 'can bo ' || i, 1990,
            printf('%06d', 100000 + i), 7, 7, ((i - 1) % 10) + 1, NULL FROM n`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO awards (subject, officer_id, unit_id, team_id, award_type_id, year, decision_number,
                         decision_number_search, decision_date, authority_id, achievement)
     WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AWARDS})
     SELECT CASE WHEN i % 5 = 0 THEN 'TAP_THE' ELSE 'CA_NHAN' END,
            CASE WHEN i % 5 = 0 THEN NULL ELSE ((i - 1) % ${OFFICERS}) + 1 END,
            CASE WHEN i % 5 = 0 THEN (i % 10) + 1 ELSE ((((i - 1) % ${OFFICERS})) % 10) + 1 END,
            NULL,
            CASE WHEN i % 5 = 0 THEN 4 ELSE 7 END,
            2000 + (i % 27), i || '/QĐ-ĐV', i || '/qđ-đv', '2026-01-01', 4, 'Thành tích'
     FROM n`,
  ).run();
  meter = meterD1(env.DB);
}, 120_000);

afterAll(async () => {
  await resetTestData(env.DB);
}, 60_000);

const measure = async <T>(label: string, fn: () => Promise<T>) => {
  meter.reset();
  await fn();
  console.info(`[d1-read-cost] ${label}: rows_read=${meter.rowsRead}`);
  return meter.rowsRead;
};

describe("D1 rows_read with 50k awards / 2k officers", () => {
  it("seeded the expected volume", async () => {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM awards").first<{ n: number }>();
    expect(n?.n).toBe(AWARDS);
  });

  it("F01 unfiltered first page", async () => {
    const rows = await measure("F01 unfiltered", () => listAwards(meter.db, { page: 1, size: 10 }));
    expect(rows).toBeLessThan(200);
  });

  it("F01 deep page and unit filter stay bounded", async () => {
    expect(
      await measure("F01 page 100", () => listAwards(meter.db, { page: 100, size: 10 })),
    ).toBeLessThan(8_000); // OFFSET walks skipped rows (~5.6 reads each incl. joins);
    await measure("F01 unit filter", () => listAwards(meter.db, { page: 1, size: 10, unit_id: 3 }));
  });

  it("F01 unit + team filter (team holds a fraction of the unit)", async () => {
    await env.DB.prepare(
      "INSERT INTO teams (id, unit_id, code, name) VALUES (901, 3, 'X-T1', 'Đội thử')",
    ).run();
    // 1 in 100 of unit 3's personal awards moves to the team
    await env.DB.prepare(
      "UPDATE awards SET team_id = 901 WHERE unit_id = 3 AND id % 100 = 3 AND subject = 'CA_NHAN'",
    ).run();
    expect(
      await measure("F01 unit+team filter", () =>
        listAwards(meter.db, { page: 1, size: 10, unit_id: 3, team_id: 901 }),
      ),
    ).toBeLessThan(500);
  });

  it("F01 search costs are recorded (decision number, officer name)", async () => {
    await measure("F01 search decision", () =>
      listAwards(meter.db, { page: 1, size: 10, q: "123/qđ" }),
    );
    await measure("F01 search officer", () =>
      listAwards(meter.db, { page: 1, size: 10, q: "can bo 17" }),
    );
  });

  it("F02 officer detail (history) reads only that officer's awards", async () => {
    expect(await measure("F02 detail", () => getOfficerDetail(meter.db, 17))).toBeLessThan(500);
  });

  it("F05 officer list page and F06 unit list", async () => {
    // Officers are sorted by unit then name: reads scale with officers (not awards).
    expect(
      await measure("F05 page", () => listOfficers(meter.db, { page: 1, size: 10 })),
    ).toBeLessThan(OFFICERS * 6);
    // Award counts come from award_counters; only officer counts scale with data.
    expect(
      await measure("F06 units", () => listUnits(meter.db, { page: 1, size: 10 })),
    ).toBeLessThan(OFFICERS + 500);
  });
});
