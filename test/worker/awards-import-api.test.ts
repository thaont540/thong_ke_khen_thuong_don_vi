import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AwardTestUsers,
  count,
  insertOfficer,
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
      saved_count: 2,
      attempted_count: 2,
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
