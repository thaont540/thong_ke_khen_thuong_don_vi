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
  newbieRow as newbie,
  ratingRow as rating,
} from "./helpers/import-test-helpers";
import { SEED } from "./helpers/test-fixtures";

let tokens: AwardTestUsers;

beforeEach(async () => {
  tokens = await setupAwardTest();
  await insertOfficer(env.DB, { id: 1 });
  await insertOfficer(env.DB, { id: 2, unitId: SEED.unitP1 });
});

const lot = async (body: unknown): Promise<LotResponse> => {
  const res = await send(tokens.editor, "POST", "/api/awards/import", body);
  expect(res.status).toBe(200);
  return (await res.json()) as LotResponse;
};
const officers = () => count("SELECT COUNT(*) n FROM officers");

describe("import: Cục CSGT unit and Xếp loại cán bộ", () => {
  it("Tập thể rows must not carry name, rank or position", async () => {
    const res = await lot(
      importBody([importCollectiveRow(2, { full_name: "Ai đó", rank: "Đại úy" })]),
    );
    expect(res.results[0]?.errors).toEqual(["Tập thể không ghi họ tên, cấp bậc, chức vụ"]);
  });
  it("collective and new Cục trưởng in unit C08", async () => {
    const res = await lot(
      importBody([
        importCollectiveRow(2, { unit: "Cục Cảnh sát giao thông", team: "" }),
        newbie(3, { unit: "C08", position: "Cục trưởng" }),
      ]),
    );
    expect(res.results.map((r) => r.status)).toEqual(["OK", "OK"]);
    const o = await env.DB.prepare(
      "SELECT u.code unit, p.name position FROM officers o JOIN units u ON u.id = o.unit_id JOIN positions p ON p.id = o.position_id WHERE o.id > 2",
    ).first();
    expect(o).toEqual({ unit: "C08", position: "Cục trưởng" });
  });

  it("rating defaults to the Cục trưởng Cục CSGT authority and is individual only", async () => {
    const res = await lot(
      importBody([
        rating(2),
        importCollectiveRow(3, { form: "Xếp loại cán bộ", award_name: "Hoàn thành tốt nhiệm vụ" }),
      ]),
    );
    expect(res.results[0]).toMatchObject({ status: "OK", imported: true });
    expect(res.results[1]?.errors).toContain("Xếp loại cán bộ chỉ áp dụng cho cá nhân");
    const a = await env.DB.prepare(
      "SELECT t.form, au.name authority FROM awards a JOIN award_types t ON t.id = a.award_type_id JOIN authorities au ON au.id = a.authority_id",
    ).first();
    expect(a).toEqual({ form: "XEP_LOAI", authority: "Cục trưởng Cục CSGT" });
  });

  it("an officer already rated for the year is a hard error (even the same rating), another year is fine", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeXepLoaiXs,
      year: 2026,
    });
    const res = await lot(
      importBody([
        rating(2),
        rating(3, { award_name: "Hoàn thành tốt nhiệm vụ" }),
        rating(4, { year: 2025 }),
      ]),
    );
    expect(res.results.map((r) => r.status)).toEqual(["ERROR", "ERROR", "OK"]);
    expect(res.results[0]?.errors).toEqual(["Cán bộ đã có xếp loại năm 2026"]);
    expect(res.results[0]?.duplicate_messages).toEqual([]);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(2);
  });

  it("a soft-deleted rating does not block a new one", async () => {
    await seedAward({
      subject: "CA_NHAN",
      officerId: 1,
      unitId: SEED.unitP6,
      typeId: SEED.typeXepLoaiXs,
      deleted: true,
    });
    expect((await lot(importBody([rating(2)]))).results[0]).toMatchObject({
      status: "OK",
      imported: true,
    });
  });

  it("two ratings of one officer-year in the same lot: the second is an error", async () => {
    const res = await lot(
      importBody([
        rating(2),
        rating(3, { award_name: "Hoàn thành tốt nhiệm vụ" }),
        newbie(4, { form: "Xếp loại cán bộ", award_name: "Hoàn thành nhiệm vụ" }),
      ]),
    );
    expect(res.results.map((r) => r.status)).toEqual(["OK", "ERROR", "OK"]);
    expect(res.results[1]?.errors).toEqual([
      "Cán bộ đã có xếp loại năm 2026 (trùng với dòng 2 trong file)",
    ]);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(2);
  });

  it("a rating of a later lot against one saved by an earlier lot is rejected by the DB check", async () => {
    const first = await lot(importBody([rating(2)], { total_rows: 2 }));
    const second = await lot(
      importBody([rating(3, { award_name: "Hoàn thành tốt nhiệm vụ" })], {
        total_rows: 2,
        batch_id: first.batch_id,
      }),
    );
    expect(second.results[0]).toMatchObject({
      status: "ERROR",
      errors: ["Cán bộ đã có xếp loại năm 2026"],
    });
  });
});

describe("import: rows of the sample file mau-import-khen-thuong.xlsx", () => {
  it("all five rows are valid and create the three individuals", async () => {
    const common = { year: 2026, authority: "" } as const;
    const res = await lot(
      importBody([
        importRow(2, {
          ...common,
          full_name: "Nguyễn Văn A",
          rank: "Đại tá",
          position: "Trưởng phòng",
          unit: "Phòng 7",
          team: "Đội Dẫn đoàn số 1",
          award_name: "Chiến sĩ thi đua cơ sở",
          decision_number: "125/QĐ-C08-P1",
          authority: "Cục trưởng Cục CSGT",
        }),
        importCollectiveRow(3, {
          unit: "Phòng 6",
          team: "Đội CSGT đường bộ cao tốc số 1",
          award_name: "Bằng khen Bộ Công an",
          decision_number: "4521/QĐ-BCA",
          decision_date: "20/09/2026",
          authority: "Bộ trưởng Bộ Công an",
        }),
        importRow(4, {
          ...common,
          full_name: "Nguyễn Văn B",
          rank: "Thiếu tá",
          position: "Cán bộ",
          unit: "Phòng 7",
          team: "Đội Dẫn đoàn số 1",
          form: "Khen thưởng",
          award_name: "Huân chương Bảo vệ Tổ quốc hạng Ba",
          decision_number: "1580/QĐ-CTN",
          authority: "Chủ tịch nước",
        }),
        rating(5, {
          full_name: "Nguyễn Văn C",
          rank: "Thiếu tá",
          position: "Cán bộ",
          unit: "Phòng 5",
          decision_number: "126/QĐ-C08-P1",
          decision_date: "30/12/2026",
          authority: "Cục trưởng Cục CSGT",
        }),
        rating(6, {
          full_name: "Nguyễn Văn D",
          rank: "Thiếu tá",
          position: "Cán bộ",
          unit: "Phòng 4",
          year: 2027,
          award_name: "Hoàn thành tốt nhiệm vụ",
          decision_number: "128/QĐ-C08-P1",
          decision_date: "30/12/2027",
        }),
      ]),
    );
    expect(res.results.map((r) => [r.status, r.errors])).toEqual(Array(5).fill(["OK", []]));
    expect(res.imported_count).toBe(5);
    expect(await officers()).toBe(6);
  });
});
