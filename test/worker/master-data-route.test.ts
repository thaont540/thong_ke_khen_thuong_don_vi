import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { masterDataDtoSchema } from "../../src/shared/schemas/master-data-dto";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

let token: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "viewer1", role: "VIEWER" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  token = await createSession(env.DB, 1);
});

describe("GET /api/master", () => {
  it("returns seeded catalog matching the shared DTO schema, no-store", async () => {
    const res = await api("/api/master", { token });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = masterDataDtoSchema.parse(await res.json());
    expect(data.units).toHaveLength(11);
    expect(data.units.flatMap((u) => u.teams)).toHaveLength(13);
    expect(data.ranks).toHaveLength(15);
    expect(data.positions).toHaveLength(9);
    expect(data.authorities).toHaveLength(5);
    expect(data.award_types).toHaveLength(16);
    expect(data.award_variants).toHaveLength(6);
    expect(data).not.toHaveProperty("officer_ratings");
  });

  it("CR 19/10/2026 catalog: Cục CSGT first, Cục leadership, Cục authority, 4 rating types", async () => {
    const data = masterDataDtoSchema.parse(await (await api("/api/master", { token })).json());
    expect(data.units[0]).toMatchObject({
      code: "C08",
      name: "Cục Cảnh sát giao thông",
      kind: "CUC",
      teams: [],
    });
    expect(data.positions.slice(0, 2).map((p) => p.name)).toEqual(["Cục trưởng", "Phó Cục trưởng"]);
    const authority = data.authorities.find((a) => a.code === "CUC_TRUONG");
    expect(authority?.name).toBe("Cục trưởng Cục CSGT");
    const ratings = data.award_types.filter((t) => t.form === "XEP_LOAI");
    expect(ratings.map((t) => t.name)).toEqual([
      "Hoàn thành xuất sắc nhiệm vụ",
      "Hoàn thành tốt nhiệm vụ",
      "Hoàn thành nhiệm vụ",
      "Không hoàn thành nhiệm vụ",
    ]);
    expect(ratings.every((t) => t.subject_scope === "CA_NHAN" && !t.requires_variant)).toBe(true);
    expect(ratings.every((t) => t.default_authority_id === authority?.id)).toBe(true);
  });

  it("is sorted by sort_order and nests teams under their unit", async () => {
    const data = masterDataDtoSchema.parse(await (await api("/api/master", { token })).json());
    for (const list of [
      data.units,
      data.ranks,
      data.positions,
      data.authorities,
      data.award_types,
    ]) {
      const orders = list.map((x) => x.sort_order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
    const p6 = data.units.find((u) => u.code === "P6");
    expect(p6?.teams).toHaveLength(11);
    expect(p6?.teams.every((t) => t.unit_id === p6.id)).toBe(true);
    expect(data.units.find((u) => u.code === "P1")?.teams).toEqual([]);
  });

  it("only active types/variants and boolean requires_variant", async () => {
    await env.DB.prepare("UPDATE award_types SET is_active = 0 WHERE code = 'GIAY_KHEN'").run();
    try {
      const data = masterDataDtoSchema.parse(await (await api("/api/master", { token })).json());
      expect(data.award_types.map((t) => t.code)).not.toContain("GIAY_KHEN");
      expect(data.award_types.find((t) => t.code === "HUAN_CHUONG")?.requires_variant).toBe(true);
    } finally {
      await env.DB.prepare("UPDATE award_types SET is_active = 1 WHERE code = 'GIAY_KHEN'").run();
    }
  });

  it("unknown route stays JSON 404", async () => {
    const res = await api("/api/does-not-exist", { token });
    expect(res.status).toBe(404);
  });
});
