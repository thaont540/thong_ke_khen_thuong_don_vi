/**
 * Local D1 used by the Playwright suite. It lives in its own persist directory
 * (`.wrangler/e2e-state`, selected through E2E_STATE_DIR in vite.config.ts), never in the
 * developer's `.wrangler/state`.
 *
 * CLI (run by the Playwright webServer command): `tsx e2e/helpers/seed-e2e-database.ts`
 *   -> wipes the directory, applies migrations, seeds the three accounts.
 * `resetE2eData()` (called from specs) restores that state through the SQLite file in <20 ms.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeText } from "../../src/shared/normalize-text";
import { hashPassword } from "../../src/worker/lib/password-hash";

export const E2E_STATE_DIR = resolve(import.meta.dirname, "../../.wrangler/e2e-state");

export const ACCOUNTS = {
  admin: { username: "e2e-admin", password: "E2e-Temp-Pass1", fullName: "Quản trị E2E" },
  editor: { username: "e2e-editor", password: "E2e-Pass-12345", fullName: "Biên tập E2E" },
  viewer: { username: "e2e-viewer", password: "E2e-Pass-12345", fullName: "Người xem E2E" },
} as const;

/** Seeded catalog ids (migration 0002): units 1..10, teams 1..13. */
const MAX_SEED_UNIT = 10;
const MAX_SEED_TEAM = 13;

function d1File(): string {
  const dir = join(E2E_STATE_DIR, "v3/d1/miniflare-D1DatabaseObject");
  const file = existsSync(dir)
    ? readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    : undefined;
  if (!file) throw new Error(`E2E D1 file not found in ${dir}; run the seed CLI first`);
  return join(dir, file);
}

async function accountRows(adminMustChange: boolean) {
  const [admin, other] = await Promise.all([
    hashPassword(ACCOUNTS.admin.password),
    hashPassword(ACCOUNTS.editor.password),
  ]);
  return [
    { id: 1, ...ACCOUNTS.admin, role: "ADMIN", hash: admin, mustChange: adminMustChange ? 1 : 0 },
    { id: 2, ...ACCOUNTS.editor, role: "EDITOR", hash: other, mustChange: 0 },
    { id: 3, ...ACCOUNTS.viewer, role: "VIEWER", hash: other, mustChange: 0 },
  ];
}

/**
 * Deletes everything specs create and re-inserts the three accounts. The admin has already
 * changed the seeded temp password unless `adminMustChange` is set (first-login flow).
 */
export async function resetE2eData(o: { adminMustChange?: boolean } = {}): Promise<void> {
  const rows = await accountRows(o.adminMustChange ?? false);
  const db = new DatabaseSync(d1File());
  try {
    db.exec("PRAGMA busy_timeout = 10000");
    db.exec("BEGIN IMMEDIATE");
    for (const t of ["awards", "import_batches", "officers", "audit_logs", "sessions", "users"]) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec(`DELETE FROM teams WHERE id > ${MAX_SEED_TEAM}`);
    db.exec(`DELETE FROM units WHERE id > ${MAX_SEED_UNIT}`);
    const insert = db.prepare(
      `INSERT INTO users (id, username, full_name, role, password_hash, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) insert.run(r.id, r.username, r.fullName, r.role, r.hash, r.mustChange);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }
}

/** Runs `fn` against the E2E database file (direct SQL for arrange steps that are not under test). */
export function withE2eDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(d1File());
  try {
    db.exec("PRAGMA busy_timeout = 10000");
    return fn(db);
  } finally {
    db.close();
  }
}

export function seedOfficer(
  db: DatabaseSync,
  o: { id: number; name: string; unitId: number; teamId?: number | null },
): void {
  db.prepare(
    `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                           rank_id, position_id, unit_id, team_id)
     VALUES (?, ?, ?, ?, 1990, ?, 7, 7, ?, ?)`,
  ).run(
    o.id,
    `CB${String(o.id).padStart(3, "0")}`,
    o.name,
    normalizeText(o.name),
    String(200000 + o.id),
    o.unitId,
    o.teamId ?? null,
  );
}

/** Personal "Chiến sĩ thi đua cơ sở" award (type 7, authority 4). */
export function seedPersonalAward(
  db: DatabaseSync,
  o: { officerId: number; unitId: number; teamId?: number | null; year: number; decision: string },
): void {
  db.prepare(
    `INSERT INTO awards (subject, officer_id, unit_id, team_id, award_type_id, year, decision_number,
                         decision_number_search, decision_date, authority_id, achievement)
     VALUES ('CA_NHAN', ?, ?, ?, 7, ?, ?, ?, ?, 4, 'Hoàn thành xuất sắc nhiệm vụ')`,
  ).run(
    o.officerId,
    o.unitId,
    o.teamId ?? null,
    o.year,
    o.decision,
    normalizeText(o.decision),
    `${o.year}-06-15`,
  );
}

function prepareDatabase(): void {
  rmSync(E2E_STATE_DIR, { recursive: true, force: true });
  const run = spawnSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", E2E_STATE_DIR],
    { stdio: "inherit" },
  );
  if (run.status !== 0) throw new Error("wrangler d1 migrations apply failed");
}

if (process.argv[1]?.endsWith("seed-e2e-database.ts")) {
  prepareDatabase();
  resetE2eData().then(
    () => console.log("E2E database ready"),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
