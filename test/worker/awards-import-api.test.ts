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

describe("POST /api/awards/import: commit", () => {
  it("saves valid rows with batch row, import_batch_id, created_by and one IMPORT audit row", async () => {
    const res = await lot(
      tokens.editor,
      importBody([importRow(2), importCollectiveRow(3), importRow(4, { unit: "Phòng 99" })], {
        client_error_rows: 1,
      }),
    );
    expect(res.imported_count).toBe(2);
    expect(res.results.map((r) => r.status)).toEqual(["OK", "OK", "ERROR"]);
    expect(res.results[2]?.errors).toEqual(['Không tìm thấy đơn vị "Phòng 99"']);
    expect(res.results[0]).toMatchObject({ imported: true });

    const batch = await batchRow();
    expect(batch).toMatchObject({
      id: res.batch_id,
      file_name: "khen-thuong.xlsx",
      total_rows: 3,
      imported_rows: 2,
      error_rows: 2, // 1 reported by the browser + 1 rejected by the server
      created_by: 2,
    });
    expect(
      await count(
        "SELECT COUNT(*) n FROM awards WHERE import_batch_id = ? AND created_by = 2",
        batch?.id ?? 0,
      ),
    ).toBe(2);

    const audits = await env.DB.prepare(
      "SELECT entity, entity_id, detail FROM audit_logs WHERE action = 'IMPORT'",
    ).all<{ entity: string; entity_id: number; detail: string }>();
    expect(audits.results).toHaveLength(1);
    expect(audits.results[0]).toMatchObject({ entity: "import_batch", entity_id: batch?.id });
    expect(JSON.parse(audits.results[0]?.detail ?? "{}")).toMatchObject({
      saved_ids_count: 2,
      rows: [2, 3],
    });
  });

  it("applies the default authority per type and the medal variant", async () => {
    await lot(
      tokens.admin,
      importBody([
        importRow(2, { form: "Khen thưởng", award_name: "Huân chương Chiến công hạng Ba" }),
      ]),
    );
    const a = await env.DB.prepare(
      "SELECT award_type_id, award_variant_id, authority_id, unit_id FROM awards",
    ).first();
    expect(a).toMatchObject({ award_type_id: 9, award_variant_id: 6, authority_id: 1, unit_id: 6 });
  });

  it("continues one batch across lots (batch_id) and sums the counters", async () => {
    const first = await lot(tokens.editor, importBody([importRow(2)], { total_rows: 2 }));
    const second = await lot(
      tokens.editor,
      importBody([importRow(3, { year: 2025 })], { total_rows: 2, batch_id: first.batch_id }),
    );
    expect(second.batch_id).toBe(first.batch_id);
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(1);
    expect(await batchRow()).toMatchObject({ total_rows: 2, imported_rows: 2 });
    expect(await count("SELECT COUNT(*) n FROM audit_logs WHERE action = 'IMPORT'")).toBe(2);
  });

  it("does not create a batch when nothing is savable", async () => {
    const res = await lot(tokens.editor, importBody([importRow(2, { year: "x" })]));
    expect(res).toMatchObject({ batch_id: null, imported_count: 0 });
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(0);
  });

  it("revalidates on the server: tampered team of another unit is rejected", async () => {
    const res = await lot(
      tokens.editor,
      importBody([importCollectiveRow(2, { team: "Đội Dẫn đoàn số 1" })]),
    );
    expect(res.results[0]).toMatchObject({ status: "ERROR", imported: false });
    expect(res.results[0]?.errors[0]).toBe('Đội "Đội Dẫn đoàn số 1" không thuộc Phòng 6');
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(0);
  });

  it("rejects an officer of another unit and an unknown code", async () => {
    const res = await lot(
      tokens.editor,
      importBody([
        importRow(2, { officer_code: "CB002" }),
        importRow(3, { officer_code: "CB404" }),
      ]),
    );
    expect(res.results[0]?.errors).toEqual(["Cán bộ Cán bộ 2 không thuộc Phòng 6"]);
    expect(res.results[1]?.errors).toEqual(["Không tìm thấy cán bộ mã CB404"]);
  });

  it("ignores soft-deleted officers", async () => {
    await insertOfficer(env.DB, { id: 3, deletedAt: "2026-01-01 00:00:00" });
    const res = await lot(tokens.editor, importBody([importRow(2, { officer_code: "CB003" })]));
    expect(res.results[0]?.errors).toEqual(["Không tìm thấy cán bộ mã CB003"]);
  });
});

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
