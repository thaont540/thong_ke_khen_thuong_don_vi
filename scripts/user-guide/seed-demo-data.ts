/**
 * Prepares the isolated guide database: wipes the state dir, applies migrations, inserts clearly
 * fake demo users, officers and awards (including yearly ratings). Direct SQL (like e2e/helpers/seed-e2e-database.ts).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeText } from "../../src/shared/normalize-text";
import { hashPassword } from "../../src/worker/lib/password-hash";
import { DEMO_AWARDS, DEMO_OFFICERS } from "./demo-records";
import { DEMO_PASSWORD, DEMO_USERS, GUIDE_STATE_DIR } from "./guide-config";

function d1File(): string {
  const dir = join(GUIDE_STATE_DIR, "v3/d1/miniflare-D1DatabaseObject");
  const file = existsSync(dir)
    ? readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    : undefined;
  if (!file) throw new Error(`Guide D1 file not found in ${dir}`);
  return join(dir, file);
}

function applyMigrations(): void {
  rmSync(GUIDE_STATE_DIR, { recursive: true, force: true });
  const run = spawnSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", GUIDE_STATE_DIR],
    { stdio: "inherit" },
  );
  if (run.status !== 0) throw new Error("wrangler d1 migrations apply failed");
}

export async function prepareDemoDatabase(): Promise<void> {
  applyMigrations();
  const hash = await hashPassword(DEMO_PASSWORD);
  const db = new DatabaseSync(d1File());
  try {
    db.exec("PRAGMA busy_timeout = 10000");
    db.exec("BEGIN IMMEDIATE");
    const user = db.prepare(
      `INSERT INTO users (id, username, full_name, role, password_hash, must_change_password,
                          is_active, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const u of DEMO_USERS) {
      const locked = "locked" in u;
      const mustChange = "mustChange" in u;
      user.run(
        u.id,
        u.username,
        u.fullName,
        u.role,
        hash,
        mustChange ? 1 : 0,
        locked ? 0 : 1,
        mustChange ? null : "2026-10-14 08:30:00",
      );
    }
    const officer = db.prepare(
      `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                             rank_id, position_id, unit_id, team_id, joined_month, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    for (const o of DEMO_OFFICERS) {
      officer.run(
        o.id,
        `CB${String(o.id).padStart(3, "0")}`,
        o.name,
        normalizeText(o.name),
        o.birthYear,
        o.badge,
        o.rankId,
        o.positionId,
        o.unitId,
        o.teamId,
        o.joined,
      );
    }
    const award = db.prepare(
      `INSERT INTO awards (subject, officer_id, unit_id, team_id, award_type_id, award_variant_id,
                           year, decision_number, decision_number_search, decision_date,
                           authority_id, achievement, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    for (const a of DEMO_AWARDS) {
      award.run(
        a.officerId === null ? "TAP_THE" : "CA_NHAN",
        a.officerId,
        a.unitId,
        a.teamId,
        a.typeId,
        a.variantId,
        a.year,
        a.decision,
        normalizeText(a.decision),
        a.date,
        a.authorityId,
        a.achievement,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }
}
