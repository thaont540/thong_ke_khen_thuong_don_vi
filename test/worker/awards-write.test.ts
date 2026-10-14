import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { awardRecordSchema } from "../../src/shared/schemas/award-schemas";
import { errorOf } from "./helpers/auth-helpers";
import {
  collectiveBody,
  count,
  insertOfficer,
  personalBody,
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

describe("POST /api/awards", () => {
  it("personal: stores the officer's unit/team (BR-02), sets decision_number_search, audits once", async () => {
    const res = await send(
      editor,
      "POST",
      "/api/awards",
      personalBody(1, { decision_number: " 125/QĐ-ĐV " }),
    );
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    expect(await row(id)).toMatchObject({
      subject: "CA_NHAN",
      officer_id: 1,
      unit_id: SEED.unitP6,
      team_id: SEED.teamP6Ct1,
      decision_number: "125/QĐ-ĐV",
      decision_number_search: "125/qđ-đv",
      created_by: 2,
    });
    expect(await audits("CREATE")).toBe(1);
    const log = await env.DB.prepare(
      "SELECT entity_id FROM audit_logs WHERE action = 'CREATE'",
    ).first<{
      entity_id: number;
    }>();
    expect(log?.entity_id).toBe(id);
  });

  it("collective at unit level and team level, incl. Đơn vị quyết thắng at team level (BR-01)", async () => {
    const a = await send(editor, "POST", "/api/awards", collectiveBody(SEED.unitP6, null));
    const b = await send(
      editor,
      "POST",
      "/api/awards",
      collectiveBody(SEED.unitP6, SEED.teamP6Ct1, { award_type_id: 3 }),
    );
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await count("SELECT COUNT(*) n FROM awards WHERE team_id IS NULL")).toBe(1);
  });

  it("rejects an unknown or soft-deleted officer with 422 and writes no audit", async () => {
    await env.DB.prepare("UPDATE officers SET deleted_at = datetime('now') WHERE id = 2").run();
    for (const officer of [999, 2]) {
      const res = await send(editor, "POST", "/api/awards", personalBody(officer));
      expect(res.status).toBe(422);
      expect((await errorOf(res)).fields).toHaveProperty("officer_id");
    }
    expect(await audits("CREATE")).toBe(0);
  });

  it.each([
    [
      "collective + individual-only type",
      () => collectiveBody(SEED.unitP6, null, { award_type_id: SEED.typeCstdCoSo }),
      "award_type_id",
    ],
    [
      "medal without variant",
      () => personalBody(1, { award_type_id: SEED.typeHuanChuong }),
      "award_variant_id",
    ],
    [
      "variant of another type",
      () =>
        personalBody(1, {
          award_type_id: SEED.typeGiayKhen,
          award_variant_id: SEED.variantHcBvtq1,
        }),
      "award_variant_id",
    ],
    ["team of another unit", () => collectiveBody(SEED.unitP6, SEED.teamP7Dd1), "team_id"],
    ["unknown authority", () => personalBody(1, { authority_id: 99 }), "authority_id"],
  ])("422 %s", async (_n, body, field) => {
    const res = await send(editor, "POST", "/api/awards", body());
    expect(res.status).toBe(422);
    expect((await errorOf(res)).fields).toHaveProperty(field);
  });

  it("accepts a medal with its variant", async () => {
    const res = await send(
      editor,
      "POST",
      "/api/awards",
      personalBody(1, {
        award_type_id: SEED.typeHuanChuong,
        award_variant_id: SEED.variantHcBvtq1,
      }),
    );
    expect(res.status).toBe(201);
  });

  it("400 on malformed input (bad date, personal without officer, too-long decision)", async () => {
    for (const bad of [
      personalBody(1, { decision_date: "2026-02-31" }),
      { ...personalBody(1), officer_id: undefined },
      personalBody(1, { decision_number: "x".repeat(51) }),
      personalBody(1, { year: 1800 }),
    ]) {
      expect((await send(editor, "POST", "/api/awards", bad)).status).toBe(400);
    }
  });
});

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
    const res = await send(
      editor,
      "PUT",
      `/api/awards/${id}`,
      personalBody(1, { achievement: "Đã sửa" }),
    );
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
    expect((await send(editor, "PUT", `/api/awards/${id}`, personalBody(2))).status).toBe(200);
    expect(await row(id)).toMatchObject({ officer_id: 2, unit_id: 7, team_id: SEED.teamP7Dd1 });
  });

  it("switches subject in both directions", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    expect(
      (await send(editor, "PUT", `/api/awards/${id}`, collectiveBody(SEED.unitP6, null))).status,
    ).toBe(200);
    expect(await row(id)).toMatchObject({
      subject: "TAP_THE",
      officer_id: null,
      unit_id: SEED.unitP6,
    });
    expect((await send(editor, "PUT", `/api/awards/${id}`, personalBody(2))).status).toBe(200);
    expect(await row(id)).toMatchObject({ subject: "CA_NHAN", officer_id: 2, unit_id: 7 });
  });

  it("audit row holds before and after", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    await send(editor, "PUT", `/api/awards/${id}`, personalBody(1, { year: 2025 }));
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
      expect((await send(editor, "PUT", `/api/awards/${id}`, personalBody(1))).status).toBe(404);
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
