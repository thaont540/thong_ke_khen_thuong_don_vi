import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { findDuplicatesBulk } from "../../src/worker/services/award-duplicate-check-service";
import { errorOf } from "./helpers/auth-helpers";
import {
  collectiveBody,
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
  await insertOfficer(env.DB, { id: 1, teamId: SEED.teamP6Ct1 });
});

const post = (body: unknown) => send(editor, "POST", "/api/awards", body);
const dupsOf = async (res: Response) =>
  (
    (await errorOf(res)) as unknown as {
      duplicates: { id: number; decision_number: string; type_name: string }[];
    }
  ).duplicates;

describe("BR-08 duplicate warning", () => {
  it("personal: same officer + type + year -> 409 with list; confirm_duplicate saves", async () => {
    const existing = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      decision: "77/QĐ",
    });
    const res = await post(personalBody(1));
    expect(res.status).toBe(409);
    expect((await errorOf(res.clone())).code).toBe("DUPLICATE");
    expect(await dupsOf(res)).toEqual([
      { id: existing, decision_number: "77/QĐ", year: 2026, type_name: "Chiến sĩ thi đua cơ sở" },
    ]);
    expect((await post(personalBody(1, { confirm_duplicate: true }))).status).toBe(201);
  });

  it("different year, type, or officer is not a duplicate", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    await insertOfficer(env.DB, { id: 2 });
    expect((await post(personalBody(1, { year: 2025 }))).status).toBe(201);
    expect((await post(personalBody(1, { award_type_id: SEED.typeGiayKhen }))).status).toBe(201);
    expect((await post(personalBody(2))).status).toBe(201);
  });

  it("medal: different variant is not a duplicate, same variant is", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeHuanChuong,
      variantId: SEED.variantHcBvtq1,
    });
    const medal = (variant: number) =>
      personalBody(1, { award_type_id: SEED.typeHuanChuong, award_variant_id: variant });
    expect((await post(medal(2))).status).toBe(201);
    const res = await post(medal(SEED.variantHcBvtq1));
    expect(res.status).toBe(409);
    expect((await dupsOf(res))[0]?.type_name).toBe("Huân chương Bảo vệ Tổ quốc hạng Nhất");
  });

  it("soft-deleted records are not duplicates", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      deleted: true,
    });
    expect((await post(personalBody(1))).status).toBe(201);
  });

  it("update excludes the record itself but still sees others", async () => {
    const a = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    expect((await putAward(editor, a, personalBody(1))).status).toBe(200);
    const b = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeGiayKhen,
      decision: "9/QĐ",
    });
    const res = await putAward(editor, b, personalBody(1, { award_type_id: SEED.typeCstdCoSo }));
    expect(res.status).toBe(409);
    expect((await dupsOf(res)).map((d) => d.id)).toEqual([a]);
  });

  it("collective: unit-level and team-level are different targets; same target duplicates", async () => {
    await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      teamId: null,
      typeId: SEED.typeDvTienTien,
    });
    expect((await post(collectiveBody(SEED.unitP6, SEED.teamP6Ct1))).status).toBe(201);
    expect((await post(collectiveBody(SEED.unitP6, null))).status).toBe(409);
    expect((await post(collectiveBody(SEED.unitP6, SEED.teamP6Ct1))).status).toBe(409);
    expect((await post(collectiveBody(SEED.unitP1, null))).status).toBe(201);
  });

  it("bulk API returns one list per key in order (reused by import)", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    const key = {
      subject: "CA_NHAN" as const,
      officerId: 1,
      unitId: null,
      teamId: null,
      awardTypeId: SEED.typeCstdCoSo,
      variantId: null,
    };
    const res = await findDuplicatesBulk(env.DB, [
      { ...key, year: 2025 },
      { ...key, year: 2026 },
    ]);
    expect(res.map((r) => r.length)).toEqual([0, 1]);
    expect(await findDuplicatesBulk(env.DB, [])).toEqual([]);
  });
});
