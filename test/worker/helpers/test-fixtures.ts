import { normalizeText } from "../../../src/shared/normalize-text";

/** pbkdf2$sha256$100000$... for the password below (precomputed, avoids CPU in tests). */
export const TEST_PASSWORD = "Password-12345";
export const TEST_PASSWORD_HASH =
  "pbkdf2$sha256$100000$euzO62SrwOS1AfUyGRYxrg==$arAMBDT9iqYBtNoeLnNgf3XWl79Eh4p3n9fb97lKdpQ=";

/** Seed ids (migration 0002). */
export const SEED = {
  unitP6: 6,
  unitP1: 1,
  teamP6Ct1: 1,
  teamP7Dd1: 12,
  typeDvTienTien: 4, // TAP_THE
  typeCstdCoSo: 7, // CA_NHAN
  typeHuanChuong: 9, // CA_HAI, requires variant
  typeGiayKhen: 12,
  variantHcBvtq1: 1,
  authorityDv: 4,
  rankDaiUy: 7,
  positionCanBo: 7,
} as const;

type Bind = string | number | null;

async function run(db: D1Database, sql: string, ...binds: Bind[]) {
  return db
    .prepare(sql)
    .bind(...binds)
    .run();
}

export async function insertUser(
  db: D1Database,
  o: { id: number; username: string; role?: "ADMIN" | "EDITOR" | "VIEWER" },
) {
  await run(
    db,
    `INSERT INTO users (id, username, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?)`,
    o.id,
    o.username,
    o.username,
    o.role ?? "ADMIN",
    TEST_PASSWORD_HASH,
  );
}

export async function insertUnit(db: D1Database, id: number, code: string, name: string) {
  await run(
    db,
    `INSERT INTO units (id, code, name, kind) VALUES (?, ?, ?, 'PHONG')`,
    id,
    code,
    name,
  );
}

export async function insertTeam(
  db: D1Database,
  id: number,
  unitId: number,
  code: string,
  name: string,
) {
  await run(
    db,
    `INSERT INTO teams (id, unit_id, code, name) VALUES (?, ?, ?, ?)`,
    id,
    unitId,
    code,
    name,
  );
}

export interface OfficerFixture {
  id: number;
  badge?: string;
  unitId?: number;
  teamId?: number | null;
  deletedAt?: string | null;
}

export async function insertOfficer(db: D1Database, o: OfficerFixture) {
  const name = `Cán bộ ${o.id}`;
  await run(
    db,
    `INSERT INTO officers (id, code, full_name, full_name_search, birth_year, badge_number,
                           rank_id, position_id, unit_id, team_id, deleted_at)
     VALUES (?, ?, ?, ?, 1990, ?, ?, ?, ?, ?, ?)`,
    o.id,
    `CB${String(o.id).padStart(3, "0")}`,
    name,
    normalizeText(name),
    o.badge ?? String(100000 + o.id),
    SEED.rankDaiUy,
    SEED.positionCanBo,
    o.unitId ?? SEED.unitP6,
    o.teamId ?? null,
    o.deletedAt ?? null,
  );
}

export interface AwardFixture {
  id?: number;
  subject?: "TAP_THE" | "CA_NHAN";
  officerId?: number | null;
  unitId?: number;
  teamId?: number | null;
  awardTypeId?: number;
  variantId?: number | null;
}

/** Plain INSERT (triggers apply). Defaults to an individual CSTD cơ sở award. */
export async function insertAward(db: D1Database, o: AwardFixture = {}) {
  const subject = o.subject ?? "CA_NHAN";
  const decision = "125/QĐ-ĐV";
  return run(
    db,
    `INSERT INTO awards (id, subject, officer_id, unit_id, team_id, award_type_id, award_variant_id,
                         year, decision_number, decision_number_search, decision_date, authority_id, achievement)
     VALUES (?, ?, ?, ?, ?, ?, ?, 2026, ?, ?, '2026-09-15', ?, 'Hoàn thành xuất sắc nhiệm vụ')`,
    o.id ?? null,
    subject,
    subject === "CA_NHAN" ? (o.officerId ?? null) : null,
    o.unitId ?? SEED.unitP6,
    o.teamId ?? null,
    o.awardTypeId ?? (subject === "CA_NHAN" ? SEED.typeCstdCoSo : SEED.typeDvTienTien),
    o.variantId ?? null,
    decision,
    normalizeText(decision),
    SEED.authorityDv,
  );
}

/** Removes everything tests insert (children first). Seeded catalog rows are kept. */
export async function resetTestData(db: D1Database) {
  await db.batch([
    db.prepare("DELETE FROM awards"),
    db.prepare("DELETE FROM import_batches"),
    db.prepare("DELETE FROM officers"),
    db.prepare("DELETE FROM audit_logs"),
    db.prepare("DELETE FROM sessions"),
    db.prepare("DELETE FROM users"),
    db.prepare("DELETE FROM teams WHERE id >= 900"),
    db.prepare("DELETE FROM units WHERE id >= 900"),
  ]);
}
