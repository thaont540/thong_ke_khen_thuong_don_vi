import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { officerListResponseSchema } from "../../src/shared/schemas/officer-schemas";
import { api, createSession, errorOf } from "./helpers/auth-helpers";
import {
  insertAward,
  insertOfficer,
  insertUser,
  resetTestData,
  SEED,
} from "./helpers/test-fixtures";

const db = env.DB;
let token: string;

beforeEach(async () => {
  await resetTestData(db);
  await insertUser(db, { id: 1, username: "admin1" });
  await db.prepare("UPDATE users SET must_change_password = 0").run();
  token = await createSession(db, 1);
});

const body = (over: Record<string, unknown> = {}) => ({
  full_name: "  Nguyễn   Văn An ",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: SEED.rankDaiUy,
  position_id: SEED.positionCanBo,
  unit_id: SEED.unitP6,
  team_id: SEED.teamP6Ct1,
  ...over,
});
const post = (b: unknown) => api("/api/officers", { method: "POST", token, body: b });
const put = (id: number, b: unknown) =>
  api(`/api/officers/${id}`, { method: "PUT", token, body: b });
const list = async (qs = "") =>
  officerListResponseSchema.parse(await (await api(`/api/officers${qs}`, { token })).json());
const auditCount = async (action: string) =>
  (
    (await db
      .prepare("SELECT COUNT(*) n FROM audit_logs WHERE entity = 'officer' AND action = ?")
      .bind(action)
      .first<{ n: number }>()) as { n: number }
  ).n;

describe("POST /api/officers", () => {
  it("creates with generated code, collapsed name, and one audit row", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    const o = (await res.json()) as { code: string; full_name: string; award_count: number };
    expect(o).toMatchObject({ code: "CB001", full_name: "Nguyễn Văn An", award_count: 0 });
    expect(await auditCount("CREATE")).toBe(1);
  });

  it("code sequence continues after a soft delete (never reused)", async () => {
    await post(body());
    const second = (await (await post(body({ badge_number: "222222" }))).json()) as { id: number };
    await api(`/api/officers/${second.id}`, { method: "DELETE", token });
    const third = (await (await post(body({ badge_number: "333333" }))).json()) as { code: string };
    expect(third.code).toBe("CB003");
  });

  it("rejects 5-digit and non-numeric badge with 400", async () => {
    expect((await post(body({ badge_number: "12345" }))).status).toBe(400);
    expect((await post(body({ badge_number: "12a456" }))).status).toBe(400);
  });

  it("rejects a duplicate active badge (409 field) but allows one held by a soft-deleted officer", async () => {
    await post(body());
    const dup = await post(body());
    expect(dup.status).toBe(409);
    expect((await errorOf(dup)).fields).toHaveProperty("badge_number");
    await insertOfficer(db, { id: 50, badge: "777777", deletedAt: "2026-01-01 00:00:00" });
    expect((await post(body({ badge_number: "777777" }))).status).toBe(201);
  });

  it("rejects a team outside the unit with 422 and unknown rank with 400", async () => {
    const res = await post(body({ unit_id: SEED.unitP1, team_id: SEED.teamP6Ct1 }));
    expect(res.status).toBe(422);
    expect((await post(body({ rank_id: 9999 }))).status).toBe(400);
    expect(await auditCount("CREATE")).toBe(0);
  });

  it("allows no team (null)", async () => {
    expect((await post(body({ unit_id: SEED.unitP1, team_id: null }))).status).toBe(201);
  });
});

describe("GET /api/officers", () => {
  beforeEach(async () => {
    await post(body({ full_name: "Nguyễn Văn An", badge_number: "100001" }));
    await post(body({ full_name: "Trần Thị Bình", badge_number: "200002", team_id: null }));
    await post(
      body({
        full_name: "Lê Văn 100%",
        badge_number: "300003",
        unit_id: SEED.unitP1,
        team_id: null,
      }),
    );
  });

  it("filters by unit / team and orders by unit then name", async () => {
    expect((await list(`?unit_id=${SEED.unitP1}`)).items.map((o) => o.badge_number)).toEqual([
      "300003",
    ]);
    expect((await list(`?team_id=${SEED.teamP6Ct1}`)).total).toBe(1);
    expect((await list()).items.map((o) => o.badge_number)).toEqual(["300003", "100001", "200002"]);
  });

  it("search matches normalised name, badge prefix and code; % is literal (BR-07)", async () => {
    expect((await list("?q=" + encodeURIComponent("NGUYỄN  văn"))).total).toBe(1);
    expect((await list("?q=2000")).items[0]?.badge_number).toBe("200002");
    expect((await list("?q=cb003")).items[0]?.badge_number).toBe("300003");
    expect((await list("?q=%25")).items.map((o) => o.badge_number)).toEqual(["300003"]);
    expect((await list("?q=0002")).total).toBe(0); // badge is prefix-only
  });

  it("paginates 10 per page and reports award_count of active awards only", async () => {
    const id = (await list("?q=100001")).items[0]?.id ?? 0;
    await insertAward(db, { officerId: id });
    await insertAward(db, { officerId: id });
    await db
      .prepare(
        "UPDATE awards SET deleted_at = datetime('now') WHERE id = (SELECT MIN(id) FROM awards)",
      )
      .run();
    const page = await list("?q=100001");
    expect(page).toMatchObject({ page: 1, size: 10 });
    expect(page.items[0]?.award_count).toBe(1);
  });

  it("unit/team filter uses ix_officers_unit_team", async () => {
    const plan = await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM officers o WHERE o.deleted_at IS NULL AND o.unit_id = ? AND o.team_id = ?",
      )
      .bind(SEED.unitP6, SEED.teamP6Ct1)
      .all<{ detail: string }>();
    expect(plan.results.map((r) => r.detail).join(" ")).toContain("ix_officers_unit_team");
  });
});

describe("PUT /api/officers/:id", () => {
  it("updates fields, keeps code, does not touch existing awards (BR-02)", async () => {
    const created = (await (await post(body())).json()) as { id: number };
    await insertAward(db, { officerId: created.id, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
    const res = await put(
      created.id,
      body({ unit_id: SEED.unitP1, team_id: null, full_name: "Nguyễn Văn B" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ code: "CB001", unit_id: SEED.unitP1, team_id: null });
    const award = await db.prepare("SELECT unit_id, team_id FROM awards").first();
    expect(award).toEqual({ unit_id: SEED.unitP6, team_id: SEED.teamP6Ct1 });
    expect(await auditCount("UPDATE")).toBe(1);
  });

  it("keeps own badge, conflicts with another active badge, 404 when missing/deleted", async () => {
    const a = (await (await post(body())).json()) as { id: number };
    await post(body({ badge_number: "222222" }));
    expect((await put(a.id, body())).status).toBe(200);
    const conflict = await put(a.id, body({ badge_number: "222222" }));
    expect(conflict.status).toBe(409);
    expect((await put(9999, body())).status).toBe(404);
    await api(`/api/officers/${a.id}`, { method: "DELETE", token });
    expect((await put(a.id, body())).status).toBe(404);
  });
});

describe("DELETE /api/officers/:id", () => {
  it("soft-deletes the officer and all of their awards, reports the count, one audit row", async () => {
    const o = (await (await post(body())).json()) as { id: number };
    await insertAward(db, { officerId: o.id });
    await insertAward(db, { officerId: o.id });
    await insertOfficer(db, { id: 60 });
    await insertAward(db, { officerId: 60 });
    const res = await api(`/api/officers/${o.id}`, { method: "DELETE", token });
    expect(await res.json()).toEqual({ ok: true, deleted_awards: 2 });
    const rows = await db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM awards WHERE deleted_at IS NULL) live, (SELECT COUNT(*) FROM officers WHERE id = ? AND deleted_at IS NOT NULL) gone",
      )
      .bind(o.id)
      .first<{ live: number; gone: number }>();
    expect(rows).toEqual({ live: 1, gone: 1 });
    expect((await list()).items.map((x) => x.id)).not.toContain(o.id);
    expect(await auditCount("DELETE")).toBe(1);
    expect((await api(`/api/officers/${o.id}`, { method: "DELETE", token })).status).toBe(404);
  });
});
