import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/worker/lib/app-error";
import { handleError, mapD1Error } from "../../src/worker/lib/error-handler";
import { toPageParams } from "../../src/worker/lib/pagination";
import { toLikePattern } from "../../src/worker/lib/sql-like-pattern";
import { insertAward, insertOfficer, resetTestData, SEED } from "./helpers/test-fixtures";

async function errorOf(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected rejection");
}

describe("mapD1Error (real D1 errors)", () => {
  it("trigger -> 422 CONSTRAINT with RAISE text", async () => {
    await resetTestData(env.DB);
    const err = await errorOf(() =>
      insertAward(env.DB, { subject: "TAP_THE", awardTypeId: SEED.typeCstdCoSo }),
    );
    const mapped = mapD1Error(err);
    expect(mapped?.status).toBe(422);
    expect(mapped?.code).toBe("CONSTRAINT");
    expect(mapped?.message).toBe("Danh hiệu / khen thưởng không áp dụng cho đối tượng này");
  });

  it("more specific officer-team text wins over the generic team text", async () => {
    await resetTestData(env.DB);
    const err = await errorOf(() =>
      insertOfficer(env.DB, { id: 1, unitId: SEED.unitP1, teamId: SEED.teamP6Ct1 }),
    );
    expect(mapD1Error(err)?.message).toBe("Đội không thuộc đơn vị của cán bộ");
  });

  it("UNIQUE -> 409 CONFLICT", async () => {
    await resetTestData(env.DB);
    await insertOfficer(env.DB, { id: 1, badge: "111111" });
    const err = await errorOf(() => insertOfficer(env.DB, { id: 2, badge: "111111" }));
    const mapped = mapD1Error(err);
    expect(mapped?.status).toBe(409);
    expect(mapped?.code).toBe("CONFLICT");
  });

  it("other constraint (CHECK) -> generic 422; non-D1 error -> null", async () => {
    await resetTestData(env.DB);
    const err = await errorOf(() => insertOfficer(env.DB, { id: 1, badge: "abc" }));
    expect(mapD1Error(err)?.status).toBe(422);
    expect(mapD1Error(new Error("boom"))).toBeNull();
    expect(mapD1Error("x")).toBeNull();
  });
});

describe("handleError envelope", () => {
  const app = new Hono();
  app.get("/app", () => {
    throw AppError.notFound("Không có");
  });
  app.get("/zod", (c) => c.json(z.object({ a: z.string() }).parse({})));
  app.get("/dup", () => {
    throw new AppError(409, "DUPLICATE", "trùng", undefined, { duplicates: [{ id: 1 }] });
  });
  app.get("/boom", () => {
    throw new Error("secret detail");
  });
  app.onError(handleError);

  it("AppError", async () => {
    const res = await app.request("/app");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Không có" } });
  });

  it("ZodError -> 400 with fields", async () => {
    const res = await app.request("/zod");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields: Record<string, string> } };
    expect(body.error.code).toBe("VALIDATION");
    expect(Object.keys(body.error.fields)).toEqual(["a"]);
  });

  it("extra members are merged into error", async () => {
    const body = (await (await app.request("/dup")).json()) as { error: { duplicates: unknown[] } };
    expect(body.error.duplicates).toEqual([{ id: 1 }]);
  });

  it("unknown error -> 500 without leaking details", async () => {
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("toLikePattern", () => {
  it("normalizes and wraps", () => {
    expect(toLikePattern("  QĐ   125 ")).toBe("%qđ 125%");
  });
  it("escapes wildcards", () => {
    expect(toLikePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });
  it("truncates to 50 chars and ignores blanks", () => {
    expect(toLikePattern("a".repeat(80))).toBe(`%${"a".repeat(50)}%`);
    expect(toLikePattern("   ")).toBeNull();
    expect(toLikePattern(undefined)).toBeNull();
  });
  it("works with SQLite ESCAPE", async () => {
    await resetTestData(env.DB);
    await insertOfficer(env.DB, { id: 1 });
    await insertAward(env.DB, { officerId: 1 });
    const q = (term: string) =>
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM awards WHERE decision_number_search LIKE ? ESCAPE '\\'",
      )
        .bind(toLikePattern(term))
        .first<{ n: number }>();
    expect((await q("QĐ-đv"))?.n).toBe(1); // Unicode case-insensitive via normalized column
    expect((await q("%"))?.n).toBe(0); // literal percent, not wildcard
  });
});

describe("toPageParams", () => {
  it("defaults", () => {
    expect(toPageParams()).toEqual({ page: 1, size: 10, limit: 10, offset: 0 });
  });
  it("clamps", () => {
    expect(toPageParams(0, 999)).toMatchObject({ page: 1, size: 50 });
    expect(toPageParams(-3, 0)).toMatchObject({ page: 1, size: 1 });
    expect(toPageParams(3, 20)).toMatchObject({ offset: 40, limit: 20 });
    expect(toPageParams(Number.NaN, Number.NaN)).toMatchObject({ page: 1, size: 10 });
  });
});
