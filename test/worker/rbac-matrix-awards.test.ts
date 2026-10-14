import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AwardTestUsers,
  insertOfficer,
  personalBody,
  seedAward,
  send,
  setupAwardTest,
} from "./helpers/award-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let tokens: AwardTestUsers;

beforeEach(async () => {
  tokens = await setupAwardTest();
  await insertOfficer(env.DB, { id: 1 });
  await seedAward({
    subject: "CA_NHAN",
    officerId: 1,
    unitId: SEED.unitP6,
    typeId: SEED.typeCstdCoSo,
  });
});

const WRITE_ROWS = [
  ["POST", "/api/awards"],
  ["PUT", "/api/awards/1"],
  ["DELETE", "/api/awards/1"],
  ["GET", "/api/awards/1"],
  ["GET", "/api/officers/options"],
] as const;

describe("RBAC awards slice (spec section 1)", () => {
  it.each(WRITE_ROWS)("%s %s: VIEWER -> 403, ADMIN/EDITOR not 401/403", async (method, path) => {
    const body = method === "POST" || method === "PUT" ? personalBody(1) : undefined;
    expect((await send(tokens.viewer, method, path, body)).status).toBe(403);
    for (const t of [tokens.admin, tokens.editor]) {
      // DELETE last in the list would soft-delete id 1; run on a fresh seed per call is overkill,
      // a repeated DELETE only changes 200 -> 404, never 401/403.
      const status = (await send(t, method, path, body)).status;
      expect([401, 403]).not.toContain(status);
    }
  });

  it.each([
    ["GET", "/api/awards"],
    ["GET", "/api/officers/1"],
  ] as const)("%s %s allowed for every role, 401 without session", async (method, path) => {
    for (const t of [tokens.admin, tokens.editor, tokens.viewer]) {
      expect((await send(t, method, path)).status).toBe(200);
    }
    expect((await send("", method, path)).status).toBe(401);
  });
});
