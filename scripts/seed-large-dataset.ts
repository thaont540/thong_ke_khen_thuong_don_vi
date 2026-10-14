/**
 * LOCAL ONLY: seeds 2k officers and 50k awards into the local D1 (after `npm run db:migrate:local`)
 * to eyeball F01/F02 speed in `npm run dev`. Refuses to run unless the local DB has no officers.
 *   npx tsx scripts/seed-large-dataset.ts [--awards 50000] [--officers 2000]
 * Remove again with: wrangler d1 execute DB --local --command "DELETE FROM awards; DELETE FROM officers;"
 * The same volume is exercised automatically by test/worker/d1-read-cost.test.ts.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    awards: { type: "string", default: "50000" },
    officers: { type: "string", default: "2000" },
  },
});
const awards = Number.parseInt(values.awards ?? "", 10);
const officers = Number.parseInt(values.officers ?? "", 10);
if (!Number.isInteger(awards) || !Number.isInteger(officers) || officers < 1 || awards < 1) {
  throw new Error("--awards and --officers must be positive integers");
}

const sql = `
INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number, rank_id, position_id, unit_id, team_id)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${officers})
SELECT i, 'CB' || printf('%05d', i), 'Cán bộ ' || i, 'can bo ' || i, 1990, printf('%06d', 100000 + i), 7, 7, ((i - 1) % 10) + 1, NULL FROM n;
INSERT INTO awards (subject, officer_id, unit_id, team_id, award_type_id, year, decision_number, decision_number_search, decision_date, authority_id, achievement)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${awards})
SELECT CASE WHEN i % 5 = 0 THEN 'TAP_THE' ELSE 'CA_NHAN' END,
       CASE WHEN i % 5 = 0 THEN NULL ELSE ((i - 1) % ${officers}) + 1 END,
       CASE WHEN i % 5 = 0 THEN (i % 10) + 1 ELSE (((i - 1) % ${officers}) % 10) + 1 END,
       NULL, CASE WHEN i % 5 = 0 THEN 4 ELSE 7 END, 2000 + (i % 27), i || '/QĐ-ĐV', i || '/qđ-đv', '2026-01-01', 4, 'Thành tích' FROM n;
`;

const wrangler = (args: string[]) =>
  spawnSync("npx", ["wrangler", "d1", "execute", "DB", "--local", ...args], {
    encoding: "utf8",
  });

const check = wrangler(["--json", "--command", "SELECT COUNT(*) AS n FROM officers"]);
if (check.status !== 0 || !/"n":\s*0\b/.test(check.stdout)) {
  console.error("Local DB is unreachable or already has officers; refusing to seed.");
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), "seed-large-"));
try {
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql);
  const run = spawnSync("npx", ["wrangler", "d1", "execute", "DB", "--local", "--file", file], {
    stdio: "inherit",
  });
  process.exit(run.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
