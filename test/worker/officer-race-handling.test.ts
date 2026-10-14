import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../src/worker/lib/app-error";
import { createOfficer, deleteOfficer } from "../../src/worker/services/officers-service";
import { insertOfficer, insertUser, resetTestData, SEED } from "./helpers/test-fixtures";

const db = env.DB;

/** D1 whose first `n` batches fail like a lost officers.code race; the rest run for real. */
function flakyCodeDb(n: number): { d1: D1Database; calls: () => number } {
  let calls = 0;
  const d1 = new Proxy(db, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop === "batch") {
        return (...args: Parameters<D1Database["batch"]>) => {
          calls += 1;
          if (calls <= n) {
            return Promise.reject(
              new Error("D1_ERROR: UNIQUE constraint failed: officers.code: SQLITE_CONSTRAINT"),
            );
          }
          return target.batch(...args);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { d1, calls: () => calls };
}

const input = {
  full_name: "Nguyễn Văn An",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: SEED.rankDaiUy,
  position_id: SEED.positionCanBo,
  unit_id: SEED.unitP6,
  team_id: SEED.teamP6Ct1,
};

beforeEach(async () => {
  await resetTestData(db);
  await insertUser(db, { id: 1, username: "admin1" });
});

describe("officer code generation under contention", () => {
  it("retries a lost code race up to 5 attempts", async () => {
    const { d1, calls } = flakyCodeDb(4);
    const created = await createOfficer(d1, 1, input);
    expect(created.code).toBe("CB001");
    expect(calls()).toBe(5);
  });

  it("gives up with the original error after 5 failed attempts", async () => {
    const { d1, calls } = flakyCodeDb(10);
    await expect(createOfficer(d1, 1, input)).rejects.toThrow("officers.code");
    expect(calls()).toBe(5);
  });
});

describe("deleteOfficer when a concurrent delete already won", () => {
  it("answers 404 instead of a phantom success", async () => {
    await insertOfficer(db, { id: 1 });
    const racing = new Proxy(db, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        if (prop === "batch") {
          return async (...args: Parameters<D1Database["batch"]>) => {
            // The other request commits its delete between our read and our batch.
            await target.prepare("UPDATE officers SET deleted_at = datetime('now')").run();
            return target.batch(...args);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const err = await deleteOfficer(racing, 1, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    const audits = await db
      .prepare("SELECT COUNT(*) n FROM audit_logs WHERE entity = 'officer' AND action = 'DELETE'")
      .first<{ n: number }>();
    expect(audits?.n).toBe(0);
  });
});
