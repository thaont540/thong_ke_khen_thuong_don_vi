import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  officerDetailSchema,
  officerOptionsResponseSchema,
} from "../../src/shared/schemas/officer-schemas";
import { insertOfficer, seedAward, send, setupAwardTest } from "./helpers/award-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let tokens: Awaited<ReturnType<typeof setupAwardTest>>;

beforeEach(async () => {
  tokens = await setupAwardTest();
  await insertOfficer(env.DB, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(env.DB, { id: 2, unitId: 7, teamId: SEED.teamP7Dd1 });
  await insertOfficer(env.DB, { id: 3, unitId: SEED.unitP6, deletedAt: "2026-01-01 00:00:00" });
});

describe("GET /api/officers/options", () => {
  it("lists active officers only, filtered by unit/team", async () => {
    const all = officerOptionsResponseSchema.parse(
      await (await send(tokens.editor, "GET", "/api/officers/options")).json(),
    );
    expect(all.items.map((o) => o.id).sort()).toEqual([1, 2]);
    const p7 = officerOptionsResponseSchema.parse(
      await (await send(tokens.editor, "GET", "/api/officers/options?unit_id=7")).json(),
    );
    expect(p7.items.map((o) => o.id)).toEqual([2]);
    const team = officerOptionsResponseSchema.parse(
      await (
        await send(tokens.admin, "GET", `/api/officers/options?team_id=${SEED.teamP6Ct1}`)
      ).json(),
    );
    expect(team.items.map((o) => o.id)).toEqual([1]);
  });
});

describe("GET /api/officers/:id (F02)", () => {
  it("returns officer with active awards, year desc then id desc", async () => {
    const a = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      year: 2024,
    });
    const b = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeGiayKhen,
      year: 2026,
    });
    const c = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      year: 2026,
    });
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      year: 2020,
      deleted: true,
    });
    await seedAward({ subject: "CA_NHAN", officerId: 2, unitId: 7, typeId: SEED.typeCstdCoSo });
    const res = await send(tokens.viewer, "GET", "/api/officers/1");
    expect(res.status).toBe(200);
    const dto = officerDetailSchema.parse(await res.json());
    expect(dto.awards.map((x) => x.id)).toEqual([c, b, a]);
    expect(dto).toMatchObject({ id: 1, code: "CB001", team_id: SEED.teamP6Ct1 });
  });

  it("404 for deleted, missing and non-numeric ids", async () => {
    for (const id of [3, 999, "abc"]) {
      expect((await send(tokens.admin, "GET", `/api/officers/${id}`)).status).toBe(404);
    }
  });
});
