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

describe("import batch row cap and atomicity", () => {
  it("caps saved rows per batch at the declared total_rows and rejects the overflowing lot", async () => {
    const first = await lot(tokens.editor, importBody([importRow(2)], { total_rows: 2 }));
    const over = await post(
      tokens.editor,
      importBody([importRow(3, { year: 2025 }), importRow(4, { year: 2024 })], {
        total_rows: 2,
        batch_id: first.batch_id,
      }),
    );
    expect(over.status).toBe(422);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(1);
    expect(await batchRow()).toMatchObject({ imported_rows: 1, total_rows: 2 });

    // total_rows sent by later lots cannot raise the cap
    const raise = await post(
      tokens.editor,
      importBody([importRow(3, { year: 2025 }), importRow(4, { year: 2024 })], {
        total_rows: 100,
        batch_id: first.batch_id,
      }),
    );
    expect(raise.status).toBe(422);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(1);
  });

  it("first lot larger than its declared total_rows is rejected without creating a batch", async () => {
    const res = await post(
      tokens.editor,
      importBody([importRow(2), importRow(3, { year: 2025 })], { total_rows: 1 }),
    );
    expect(res.status).toBe(422);
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(0);
  });

  it("the DB trigger aborts any write that pushes imported_rows past total_rows", async () => {
    const first = await lot(tokens.editor, importBody([importRow(2)], { total_rows: 1 }));
    await expect(
      env.DB.prepare("UPDATE import_batches SET imported_rows = 2 WHERE id = ?")
        .bind(first.batch_id)
        .run(),
    ).rejects.toThrow(/Vượt quá số dòng/);
  });

  it("client_error_rows is informational: capped by total_rows, error_rows never exceeds it", async () => {
    await lot(
      tokens.editor,
      importBody([importRow(2), importRow(3, { unit: "Phòng 99" })], {
        total_rows: 2,
        client_error_rows: 100,
      }),
    );
    expect((await batchRow())?.error_rows).toBe(2);
  });

  it("leaves no orphan batch row when the insert batch fails", async () => {
    await env.DB.prepare(
      `CREATE TRIGGER trg_test_fail BEFORE INSERT ON awards
       BEGIN SELECT RAISE(ABORT, 'Danh hiệu / khen thưởng không áp dụng cho đối tượng này'); END`,
    ).run();
    let res: Response;
    try {
      res = await post(tokens.editor, importBody([importRow(2)]));
    } finally {
      await env.DB.prepare("DROP TRIGGER trg_test_fail").run();
    }
    expect(res.status).toBe(422);
    expect(await count("SELECT COUNT(*) n FROM import_batches")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM audit_logs WHERE action = 'IMPORT'")).toBe(0);
  });
});
