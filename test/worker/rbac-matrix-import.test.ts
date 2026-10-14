import { beforeEach, describe, expect, it } from "vitest";
import { type AwardTestUsers, send, setupAwardTest } from "./helpers/award-test-helpers";
import { importBody, importRow } from "./helpers/import-test-helpers";

let tokens: AwardTestUsers;
beforeEach(async () => {
  tokens = await setupAwardTest();
});

describe("RBAC import slice (spec section 1, F04)", () => {
  const body = importBody([importRow(2)], { dry_run: true });

  it("VIEWER -> 403, anonymous -> 401", async () => {
    expect((await send(tokens.viewer, "POST", "/api/awards/import", body)).status).toBe(403);
    expect((await send("", "POST", "/api/awards/import", body)).status).toBe(401);
  });

  it("ADMIN and EDITOR may import", async () => {
    for (const t of [tokens.admin, tokens.editor]) {
      expect((await send(t, "POST", "/api/awards/import", body)).status).toBe(200);
    }
  });
});
