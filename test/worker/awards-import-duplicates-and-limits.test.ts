import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AwardTestUsers,
  count,
  insertOfficer,
  seedAward,
  send,
  setupAwardTest,
} from "./helpers/award-test-helpers";
import {
  importBody,
  importCollectiveRow,
  importRow,
  type LotResponse,
} from "./helpers/import-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let tokens: AwardTestUsers;

beforeEach(async () => {
  tokens = await setupAwardTest();
  await insertOfficer(env.DB, { id: 1 });
  await insertOfficer(env.DB, { id: 2, unitId: SEED.unitP1 });
});

const post = (token: string, body: unknown) => send(token, "POST", "/api/awards/import", body);
const lot = async (token: string, body: unknown): Promise<LotResponse> => {
  const res = await post(token, body);
  expect(res.status).toBe(200);
  return (await res.json()) as LotResponse;
};
const batchRow = () =>
  env.DB.prepare("SELECT * FROM import_batches").first<{
    id: number;
    file_name: string;
    total_rows: number;
    imported_rows: number;
    error_rows: number;
    created_by: number;
  }>();

describe("duplicates (BR-08)", () => {
  beforeEach(async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeCstdCoSo,
      decision: "77/QĐ-A",
    });
  });

  it("flags a row duplicating the DB and skips it by default", async () => {
    const res = await lot(tokens.editor, importBody([importRow(2), importRow(3, { year: 2025 })]));
    expect(res.results[0]).toMatchObject({
      status: "DUPLICATE",
      imported: false,
      duplicate_messages: ["Trùng với bản ghi đã có (quyết định 77/QĐ-A)"],
    });
    expect(res.results[1]?.status).toBe("OK");
    expect(res.imported_count).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(2);
  });

  it("saves the duplicate when include_duplicates is true", async () => {
    const res = await lot(tokens.editor, importBody([importRow(2)], { include_duplicates: true }));
    expect(res.results[0]).toMatchObject({ status: "DUPLICATE", imported: true });
    expect(await count("SELECT COUNT(*) n FROM awards WHERE deleted_at IS NULL")).toBe(2);
  });

  it("ignores soft-deleted records", async () => {
    await env.DB.prepare("UPDATE awards SET deleted_at = datetime('now')").run();
    const res = await lot(tokens.editor, importBody([importRow(2)]));
    expect(res.results[0]?.status).toBe("OK");
  });

  it("flags rows duplicating an earlier row of the same lot", async () => {
    const res = await lot(
      tokens.editor,
      importBody([
        importRow(2, { year: 2024 }),
        importRow(3, { year: 2024, decision_number: "9/QĐ" }),
      ]),
    );
    expect(res.results[0]?.status).toBe("OK");
    expect(res.results[1]).toMatchObject({
      status: "DUPLICATE",
      duplicate_messages: ["Trùng với dòng 2 trong file"],
      imported: false,
    });
  });

  it("an earlier lot's saved rows are caught as DB duplicates in the next lot", async () => {
    const first = await lot(tokens.editor, importBody([importRow(2, { year: 2024 })]));
    const second = await lot(
      tokens.editor,
      importBody([importRow(3, { year: 2024, decision_number: "9/QĐ" })], {
        batch_id: first.batch_id,
      }),
    );
    expect(second.results[0]?.status).toBe("DUPLICATE");
  });
});

describe("dry_run", () => {
  it("validates and detects duplicates without writing anything", async () => {
    await seedAward({
      subject: "TAP_THE",
      unitId: SEED.unitP6,
      teamId: SEED.teamP6Ct1,
      typeId: 10 + 1, // Bằng khen Bộ Công an
      decision: "5/QĐ",
    });
    const before = await count("SELECT COUNT(*) n FROM awards");
    const res = await lot(
      tokens.editor,
      importBody([importCollectiveRow(2), importRow(3), importRow(4, { year: "" })], {
        dry_run: true,
      }),
    );
    expect(res.results.map((r) => r.status)).toEqual(["DUPLICATE", "OK", "ERROR"]);
    expect(res).toMatchObject({ batch_id: null, imported_count: 0 });
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(before);
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM audit_logs WHERE action = 'IMPORT'")).toBe(0);
  });
});

describe("limits and batch ownership", () => {
  it("rejects more than 30 rows with 400", async () => {
    const rows = Array.from({ length: 31 }, (_, i) => importRow(i + 2, { year: 1990 + i }));
    expect((await post(tokens.editor, importBody(rows))).status).toBe(400);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(0);
  });

  it.each([
    ["empty rows", { rows: [] }],
    ["total_rows over 1000", { total_rows: 1001 }],
    ["missing file name", { file_name: "" }],
  ])("rejects invalid body: %s", async (_n, over) => {
    expect((await post(tokens.editor, importBody([importRow(2)], over))).status).toBe(400);
  });

  it("rejects bodies over 256 KB with 413", async () => {
    const big = "x".repeat(5000);
    const rows = Array.from({ length: 30 }, (_, i) =>
      importRow(i + 2, { achievement: big, note: big, award_name: big, unit: big, team: big }),
    );
    expect((await post(tokens.editor, importBody(rows))).status).toBe(413);
  });

  it("batch_id of another user, unknown or older than 2 hours -> 403", async () => {
    const first = await lot(tokens.admin, importBody([importRow(2)]));
    const reuse = (batchId: number) =>
      post(tokens.editor, importBody([importRow(3, { year: 2025 })], { batch_id: batchId }));
    expect((await reuse(first.batch_id as number)).status).toBe(403);
    expect((await reuse(9999)).status).toBe(403);

    await env.DB.prepare(
      "UPDATE import_batches SET created_at = datetime('now', '-3 hours'), created_by = 2",
    ).run();
    expect((await reuse(first.batch_id as number)).status).toBe(403);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(1);
  });

  it("imports a 1000-row file as 34 sequential lots into one batch", async () => {
    for (let n = 3; n <= 10; n++) await insertOfficer(env.DB, { id: n });
    let batchId: number | undefined;
    const rows = Array.from({ length: 1000 }, (_, i) =>
      importRow(i + 2, {
        officer_code: `CB${String((i % 10) + 1).padStart(3, "0")}`,
        year: 1990 + Math.floor(i / 10),
        unit: i % 10 === 1 ? "Phòng 1" : "Phòng 6",
      }),
    );
    // Officer 2 belongs to Phòng 1 (see beforeEach); others to Phòng 6.
    let lots = 0;
    for (let i = 0; i < rows.length; i += 30) {
      const res = await lot(
        tokens.editor,
        importBody(rows.slice(i, i + 30), { total_rows: 1000, batch_id: batchId }),
      );
      expect(res.imported_count).toBe(res.results.length);
      batchId = res.batch_id ?? undefined;
      lots++;
    }
    expect(lots).toBe(34);
    expect(await batchRow()).toMatchObject({ total_rows: 1000, imported_rows: 1000 });
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(1000);
    expect(await count("SELECT COUNT(*) n FROM audit_logs WHERE action = 'IMPORT'")).toBe(34);
  }, 60_000);
});
