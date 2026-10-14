import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { masterDataDtoSchema } from "../../src/shared/schemas/master-data-dto";
import { app } from "../../src/worker/app";

describe("GET /api/master", () => {
  it("returns seeded catalog matching the shared DTO schema, no-store", async () => {
    const res = await app.request("/api/master", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = masterDataDtoSchema.parse(await res.json());
    expect(data.units).toHaveLength(10);
    expect(data.units.flatMap((u) => u.teams)).toHaveLength(13);
    expect(data.ranks).toHaveLength(15);
    expect(data.positions).toHaveLength(7);
    expect(data.authorities).toHaveLength(4);
    expect(data.award_types).toHaveLength(12);
    expect(data.award_variants).toHaveLength(6);
  });

  it("is sorted by sort_order and nests teams under their unit", async () => {
    const data = masterDataDtoSchema.parse(
      await (await app.request("/api/master", {}, env)).json(),
    );
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
      const data = masterDataDtoSchema.parse(
        await (await app.request("/api/master", {}, env)).json(),
      );
      expect(data.award_types.map((t) => t.code)).not.toContain("GIAY_KHEN");
      expect(data.award_types.find((t) => t.code === "HUAN_CHUONG")?.requires_variant).toBe(true);
    } finally {
      await env.DB.prepare("UPDATE award_types SET is_active = 1 WHERE code = 'GIAY_KHEN'").run();
    }
  });

  it("unknown route stays JSON 404", async () => {
    const res = await app.request("/api/officers/options", {}, env);
    expect(res.status).toBe(404);
  });
});
