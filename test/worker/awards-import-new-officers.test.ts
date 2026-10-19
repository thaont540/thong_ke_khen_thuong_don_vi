import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AwardTestUsers,
  count,
  insertOfficer,
  send,
  setupAwardTest,
} from "./helpers/award-test-helpers";
import {
  importBody,
  importRow,
  type LotResponse,
  newbieRow as newbie,
} from "./helpers/import-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let tokens: AwardTestUsers;

beforeEach(async () => {
  tokens = await setupAwardTest();
  await insertOfficer(env.DB, { id: 1 });
  await insertOfficer(env.DB, { id: 2, unitId: SEED.unitP1 });
});

const lot = async (body: unknown): Promise<LotResponse> => {
  const res = await send(tokens.editor, "POST", "/api/awards/import", body);
  expect(res.status).toBe(200);
  return (await res.json()) as LotResponse;
};
const officers = () => count("SELECT COUNT(*) n FROM officers");

describe("import: existing officers are matched by name + unit", () => {
  it("matches case/space-insensitively and creates nobody", async () => {
    const res = await lot(importBody([importRow(2, { full_name: "  cán   BỘ 1 " })]));
    expect(res.results[0]).toMatchObject({ status: "OK", imported: true });
    expect(res.results[0]?.new_officer).toBeUndefined();
    expect(await officers()).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM awards WHERE officer_id = 1")).toBe(1);
  });

  it("Đội blank uses the only officer of the unit whatever his team; rank/position are ignored", async () => {
    await env.DB.prepare("UPDATE officers SET team_id = ? WHERE id = 1").bind(SEED.teamP6Ct1).run();
    const res = await lot(importBody([importRow(2, { rank: "không có", position: "" })]));
    expect(res.results[0]).toMatchObject({ status: "OK", imported: true });
    expect(await officers()).toBe(2);
    const o = await env.DB.prepare(
      "SELECT rank_id, position_id FROM officers WHERE id = 1",
    ).first();
    expect(o).toMatchObject({ rank_id: SEED.rankDaiUy, position_id: SEED.positionCanBo });
  });

  it("several officers with the same name: error, nothing created, the team narrows it", async () => {
    await insertOfficer(env.DB, { id: 3, teamId: SEED.teamP6Ct1 });
    await env.DB.prepare(
      "UPDATE officers SET full_name = 'Cán bộ 1', full_name_search = 'cán bộ 1' WHERE id = 3",
    ).run();
    const res = await lot(
      importBody([importRow(2), importRow(3, { team: "Đội CSGT đường bộ cao tốc số 1" })]),
    );
    expect(res.results[0]).toMatchObject({ status: "ERROR", imported: false });
    expect(res.results[0]?.errors).toEqual([
      'Có 2 cán bộ trùng tên "Cán bộ 1" trong Phòng 6 — vui lòng kiểm tra',
    ]);
    expect(res.results[1]).toMatchObject({ status: "OK", imported: true });
    expect(await officers()).toBe(3);
    expect(await count("SELECT COUNT(*) n FROM awards WHERE officer_id = 3")).toBe(1);
  });

  it("ignores soft-deleted officers and officers of other units: a new officer is created", async () => {
    await insertOfficer(env.DB, { id: 3, deletedAt: "2026-01-01 00:00:00" });
    const res = await lot(
      importBody([
        importRow(2, { full_name: "Cán bộ 3" }),
        importRow(3, { full_name: "Cán bộ 2" }),
      ]),
    );
    expect(res.results.map((r) => r.new_officer)).toEqual([true, true]);
    expect(await officers()).toBe(5);
  });
});

describe("import: new officers", () => {
  it("creates the officer and the award atomically with audit rows", async () => {
    const res = await lot(
      importBody([
        newbie(2, {
          team: "Đội CSGT đường bộ cao tốc số 1",
          position: "Đội trưởng",
          rank: "thiếu  TÁ",
        }),
      ]),
    );
    expect(res.results[0]).toMatchObject({ status: "OK", imported: true, new_officer: true });
    const o = await env.DB.prepare(
      "SELECT * FROM officers WHERE full_name = 'Nguyễn Văn Mới'",
    ).first<Record<string, unknown>>();
    expect(o).toMatchObject({
      code: "CB003",
      full_name_search: "nguyễn văn mới",
      birth_year: null,
      badge_number: null,
      rank_id: 8,
      position_id: 5,
      unit_id: SEED.unitP6,
      team_id: SEED.teamP6Ct1,
      created_by: 2,
    });
    const a = await env.DB.prepare("SELECT officer_id, unit_id, team_id FROM awards").first();
    expect(a).toMatchObject({ officer_id: o?.id, unit_id: SEED.unitP6, team_id: SEED.teamP6Ct1 });
    const audit = await env.DB.prepare(
      "SELECT user_id, entity_id, detail FROM audit_logs WHERE action = 'CREATE' AND entity = 'officer'",
    ).all<{ user_id: number; entity_id: number; detail: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]).toMatchObject({ user_id: 2, entity_id: o?.id });
    expect(JSON.parse(audit.results[0]?.detail ?? "{}")).toMatchObject({
      via: "import",
      after: { full_name: "Nguyễn Văn Mới" },
    });
    expect(await count("SELECT COUNT(*) n FROM audit_logs WHERE action = 'IMPORT'")).toBe(1);
  });

  it("Đội blank: team NULL; the same new person in several rows is created once", async () => {
    const res = await lot(
      importBody([newbie(2), newbie(3, { year: 2025, full_name: " NGUYỄN  văn mới" })]),
    );
    expect(res.results.map((r) => r.imported)).toEqual([true, true]);
    expect(await officers()).toBe(3);
    const o = await env.DB.prepare("SELECT id, team_id FROM officers WHERE id > 2").first<{
      id: number;
      team_id: number | null;
    }>();
    expect(o?.team_id).toBeNull();
    expect(await count("SELECT COUNT(*) n FROM awards WHERE officer_id = ?", o?.id ?? 0)).toBe(2);
  });

  it("works across lots: a later lot finds the officer created by an earlier one", async () => {
    const first = await lot(importBody([newbie(2)], { total_rows: 2 }));
    const second = await lot(
      importBody([newbie(3, { year: 2025 })], { total_rows: 2, batch_id: first.batch_id }),
    );
    expect(first.results[0]?.new_officer).toBe(true);
    expect(second.results[0]).toMatchObject({ imported: true });
    expect(second.results[0]?.new_officer).toBeUndefined();
    expect(await officers()).toBe(3);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(2);
  });

  it("different team of the same name is another person", async () => {
    await lot(
      importBody([
        newbie(2, { team: "Đội CSGT đường bộ cao tốc số 1" }),
        newbie(3, { team: "Đội CSGT đường bộ cao tốc số 2" }),
      ]),
    );
    expect(await officers()).toBe(4);
  });

  it("dry run reports the note and creates nothing", async () => {
    const res = await lot(importBody([newbie(2), importRow(3)], { dry_run: true }));
    expect(res.results[0]).toMatchObject({ status: "OK", imported: false, new_officer: true });
    expect(res.results[1]?.new_officer).toBeUndefined();
    expect(await officers()).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM audit_logs")).toBe(0);
  });

  it("creates nobody for rows that are errors or skipped duplicates", async () => {
    const res = await lot(
      importBody([
        newbie(2, { decision_date: "31/02/2026" }),
        newbie(3, { full_name: "Người Thứ Hai", rank: "" }),
        newbie(4, { full_name: "Người Thứ Ba" }),
      ]),
    );
    expect(res.results.map((r) => r.status)).toEqual(["ERROR", "ERROR", "OK"]);
    expect(res.results[1]?.errors).toEqual(["Cá nhân cần có cấp bậc"]);
    expect(await officers()).toBe(3);
    expect(await count("SELECT COUNT(*) n FROM officers WHERE full_name = 'Người Thứ Ba'")).toBe(1);
  });

  it("requires name, rank and position; unknown catalog names are errors", async () => {
    const res = await lot(
      importBody([
        newbie(2, { full_name: "" }),
        newbie(3, { position: "" }),
        newbie(4, { rank: "Đại tướng quân", position: "Giám đốc" }),
      ]),
    );
    expect(res.results[0]?.errors).toEqual(["Cá nhân cần có họ tên"]);
    expect(res.results[1]?.errors).toEqual(["Cá nhân cần có chức vụ"]);
    expect(res.results[2]?.errors).toEqual([
      'Không tìm thấy cấp bậc "Đại tướng quân"',
      'Không tìm thấy chức vụ "Giám đốc"',
    ]);
    expect(await officers()).toBe(2);
  });
});
