import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { awardRecordSchema } from "../../src/shared/schemas/award-schemas";
import {} from "./helpers/auth-helpers";
import {
  collectiveBody,
  count,
  insertOfficer,
  personalBody,
  putAward,
  seedAward,
  send,
  setupAwardTest,
} from "./helpers/award-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let editor: string;

beforeEach(async () => {
  ({ editor } = await setupAwardTest());
  await insertOfficer(env.DB, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(env.DB, { id: 2, unitId: 7, teamId: SEED.teamP7Dd1 });
});

const row = (id: number) =>
  env.DB.prepare("SELECT * FROM awards WHERE id = ?").bind(id).first<Record<string, unknown>>();
const audits = (action: string) =>
  count("SELECT COUNT(*) n FROM audit_logs WHERE entity = 'award' AND action = ?", action);

describe("PUT /api/awards/:id (BR-02 edit rule)", () => {
  it("same officer keeps the stored unit/team even after the officer moved", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: SEED.typeCstdCoSo,
    });
    await env.DB.prepare("UPDATE officers SET unit_id = 7, team_id = 12 WHERE id = 1").run();
    const res = await putAward(editor, id, personalBody(1, { achievement: "Đã sửa" }));
    expect(res.status).toBe(200);
    expect(await row(id)).toMatchObject({
      unit_id: SEED.unitP6,
      team_id: SEED.teamP6Ct1,
      achievement: "Đã sửa",
    });
  });

  it("another officer takes the new officer's current unit/team", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: SEED.typeCstdCoSo,
    });
    expect((await putAward(editor, id, personalBody(2))).status).toBe(200);
    expect(await row(id)).toMatchObject({ officer_id: 2, unit_id: 7, team_id: SEED.teamP7Dd1 });
  });

  it("switches subject in both directions", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    expect((await putAward(editor, id, collectiveBody(SEED.unitP6, null))).status).toBe(200);
    expect(await row(id)).toMatchObject({
      subject: "TAP_THE",
      officer_id: null,
      unit_id: SEED.unitP6,
    });
    expect((await putAward(editor, id, personalBody(2))).status).toBe(200);
    expect(await row(id)).toMatchObject({ subject: "CA_NHAN", officer_id: 2, unit_id: 7 });
  });

  it("audit row holds before and after", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    await putAward(editor, id, personalBody(1, { year: 2025 }));
    const log = await env.DB.prepare(
      "SELECT entity_id, detail FROM audit_logs WHERE action = 'UPDATE'",
    ).first<{ entity_id: number; detail: string }>();
    expect(log?.entity_id).toBe(id);
    const detail = JSON.parse(log?.detail ?? "{}");
    expect(detail.before.year).toBe(2026);
    expect(detail.after.year).toBe(2025);
    expect(await audits("UPDATE")).toBe(1);
  });

  it("404 for missing or soft-deleted record, 404 for bad id", async () => {
    const gone = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      deleted: true,
    });
    for (const id of [gone, 9999, "abc"]) {
      expect((await putAward(editor, id, personalBody(1))).status).toBe(404);
    }
  });
});

describe("GET /api/awards/:id and DELETE", () => {
  it("returns the full DTO, 404 when deleted", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: SEED.typeCstdCoSo,
    });
    const res = await send(editor, "GET", `/api/awards/${id}`);
    const dto = awardRecordSchema.parse(await res.json());
    expect(dto).toMatchObject({
      officer_name: "Cán bộ 1",
      officer_rank_name: "Đại úy",
      form: "DANH_HIEU",
    });
    await send(editor, "DELETE", `/api/awards/${id}`);
    expect((await send(editor, "GET", `/api/awards/${id}`)).status).toBe(404);
  });

  it("soft deletes once with one audit row; repeat is 404", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    expect((await send(editor, "DELETE", `/api/awards/${id}`)).status).toBe(200);
    expect((await row(id))?.deleted_at).not.toBeNull();
    expect((await send(editor, "DELETE", `/api/awards/${id}`)).status).toBe(404);
    expect(await audits("DELETE")).toBe(1);
  });
});
