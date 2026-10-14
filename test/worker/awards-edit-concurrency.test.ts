import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  collectiveBody,
  count,
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
  await insertOfficer(env.DB, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(env.DB, { id: 2, unitId: 7, teamId: SEED.teamP7Dd1 });
});

const row = (id: number) =>
  env.DB.prepare("SELECT * FROM awards WHERE id = ?").bind(id).first<Record<string, unknown>>();
const audits = (action: string) =>
  count("SELECT COUNT(*) n FROM audit_logs WHERE entity = 'award' AND action = ?", action);

describe("PUT /api/awards/:id concurrency", () => {
  it("optimistic concurrency: a stale updated_at gets 409 and changes nothing; fresh one succeeds", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    const loaded = (await (await send(editor, "GET", `/api/awards/${id}`)).json()) as {
      updated_at: string;
    };
    const first = await putAward(
      editor,
      id,
      personalBody(1, { achievement: "Người A", updated_at: loaded.updated_at }),
    );
    expect(first.status).toBe(200);

    const stale = await putAward(
      editor,
      id,
      personalBody(1, { achievement: "Người B", updated_at: loaded.updated_at }),
    );
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { error: { message: string } }).error.message).toBe(
      "Bản ghi đã được người khác sửa, vui lòng tải lại",
    );
    expect(await row(id)).toMatchObject({ achievement: "Người A" });
    expect(await audits("UPDATE")).toBe(1);

    const reloaded = (await (await send(editor, "GET", `/api/awards/${id}`)).json()) as {
      updated_at: string;
    };
    expect(reloaded.updated_at).not.toBe(loaded.updated_at);
    const ok = await putAward(
      editor,
      id,
      personalBody(1, { achievement: "Người B", updated_at: reloaded.updated_at }),
    );
    expect(ok.status).toBe(200);
  });

  it("parallel edits of the same loaded version: exactly one wins, audit before is consistent", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    const loaded = (await (await send(editor, "GET", `/api/awards/${id}`)).json()) as {
      updated_at: string;
    };
    const statuses = (
      await Promise.all(
        ["A", "B", "C"].map((n) =>
          putAward(editor, id, personalBody(1, { achievement: n, updated_at: loaded.updated_at })),
        ),
      )
    ).map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(2);
    expect(await audits("UPDATE")).toBe(1);
  });

  it("a PUT without updated_at is rejected with 400 and changes nothing", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    const res = await send(
      editor,
      "PUT",
      `/api/awards/${id}`,
      personalBody(1, { achievement: "X" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields).toHaveProperty("updated_at");
    expect(await row(id)).not.toMatchObject({ achievement: "X" });
    expect(await audits("UPDATE")).toBe(0);
  });

  it("update to an officer deleted meanwhile is rejected (no award pointing at a deleted officer)", async () => {
    const id = await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
    });
    await env.DB.prepare("UPDATE officers SET deleted_at = datetime('now') WHERE id = 1").run();
    const res = await putAward(editor, id, personalBody(1));
    expect(res.status).toBe(422);
    expect(await audits("UPDATE")).toBe(0);
  });
});
