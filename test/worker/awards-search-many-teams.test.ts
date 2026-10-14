import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { awardListResponseSchema } from "../../src/shared/schemas/award-schemas";
import { seedAward, send, setupAwardTest } from "./helpers/award-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let viewer: string;

beforeEach(async () => {
  ({ viewer } = await setupAwardTest());
});

describe("search with many matching teams (D1 100 bound-parameter limit)", () => {
  it("120 teams matching q still answers 200 and finds the collective award", async () => {
    const teams = Array.from({ length: 120 }, (_, i) =>
      env.DB.prepare("INSERT INTO teams (id, unit_id, code, name) VALUES (?, ?, ?, ?)").bind(
        500 + i,
        SEED.unitP6,
        `BULK-T${i}`,
        `Đội zz ${i}`,
      ),
    );
    await env.DB.batch(teams);
    const id = await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      teamId: 530,
      typeId: SEED.typeDvTienTien,
    });
    const http = await send(viewer, "GET", "/api/awards?q=zz");
    expect(http.status).toBe(200);
    const res = awardListResponseSchema.parse(await http.json());
    expect(res.items.map((i) => i.id)).toEqual([id]);
    expect(res.total).toBe(1);
  });
});
