import { env } from "cloudflare:workers";
import { normalizeText } from "../../../src/shared/normalize-text";
import { api, createSession } from "./auth-helpers";
import { insertOfficer, insertUser, resetTestData, SEED } from "./test-fixtures";

export interface AwardInsert {
  subject: "TAP_THE" | "CA_NHAN";
  officerId?: number | null;
  unitId: number;
  teamId?: number | null;
  typeId: number;
  variantId?: number | null;
  year?: number;
  decision?: string;
  deleted?: boolean;
}

/** Raw INSERT (triggers apply) with control over year / decision number / soft-delete. */
export async function seedAward(a: AwardInsert): Promise<number> {
  const decision = a.decision ?? "125/QĐ-ĐV";
  const res = await env.DB.prepare(
    `INSERT INTO awards (subject, officer_id, unit_id, team_id, award_type_id, award_variant_id, year,
        decision_number, decision_number_search, decision_date, authority_id, achievement, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-09-15', ?, 'Thành tích', ?)`,
  )
    .bind(
      a.subject,
      a.officerId ?? null,
      a.unitId,
      a.teamId ?? null,
      a.typeId,
      a.variantId ?? null,
      a.year ?? 2026,
      decision,
      normalizeText(decision),
      SEED.authorityDv,
      a.deleted ? "2026-10-01 00:00:00" : null,
    )
    .run();
  return res.meta.last_row_id;
}

export interface AwardTestUsers {
  admin: string;
  editor: string;
  viewer: string;
}

/** Resets data, creates one user per role (ids 1..3) and returns their session tokens. */
export async function setupAwardTest(): Promise<AwardTestUsers> {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1", role: "ADMIN" });
  await insertUser(env.DB, { id: 2, username: "editor1", role: "EDITOR" });
  await insertUser(env.DB, { id: 3, username: "viewer1", role: "VIEWER" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  return {
    admin: await createSession(env.DB, 1),
    editor: await createSession(env.DB, 2),
    viewer: await createSession(env.DB, 3),
  };
}

export { insertOfficer };

export const personalBody = (officerId: number, over: Record<string, unknown> = {}) => ({
  subject: "CA_NHAN",
  officer_id: officerId,
  award_type_id: SEED.typeCstdCoSo,
  year: 2026,
  decision_number: "125/QĐ-ĐV",
  decision_date: "2026-09-15",
  authority_id: SEED.authorityDv,
  achievement: "Hoàn thành xuất sắc nhiệm vụ",
  ...over,
});

export const collectiveBody = (unitId: number, teamId: number | null, over = {}) => ({
  subject: "TAP_THE",
  unit_id: unitId,
  team_id: teamId,
  award_type_id: SEED.typeDvTienTien,
  year: 2026,
  decision_number: "10/QĐ-BCA",
  decision_date: "2026-08-01",
  authority_id: SEED.authorityDv,
  achievement: "Tập thể tiên tiến",
  ...over,
});

export const send = (token: string, method: string, path: string, body?: unknown) =>
  api(path, { method, token, ...(body === undefined ? {} : { body }) });

/** PUT /api/awards/:id with the loaded `updated_at` filled in (required token) unless given. */
export async function putAward(token: string, id: number | string, body: Record<string, unknown>) {
  let updatedAt = "unknown";
  const loaded = await send(token, "GET", `/api/awards/${id}`);
  if (loaded.ok) updatedAt = ((await loaded.json()) as { updated_at: string }).updated_at;
  return send(token, "PUT", `/api/awards/${id}`, { updated_at: updatedAt, ...body });
}

export const count = async (sql: string, ...binds: (string | number)[]): Promise<number> =>
  (
    (await env.DB.prepare(sql)
      .bind(...binds)
      .first<{ n: number }>()) as { n: number }
  ).n;
