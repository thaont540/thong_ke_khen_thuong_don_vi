import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildImportLookups,
  type ImportLookups,
  type ImportOfficer,
} from "../../src/shared/import/import-lookup-maps";
import { validateImportRow } from "../../src/shared/import/import-row-validator";
import type { ImportRow } from "../../src/shared/schemas/award-import-schemas";
import { getMasterData } from "../../src/worker/services/master-data-service";

const OFFICERS: ImportOfficer[] = [
  { id: 11, code: "CB001", full_name: "Nguyễn Văn An", unit_id: 6, team_id: 1 },
  { id: 12, code: "CB002", full_name: "Trần Thị Bình", unit_id: 5, team_id: null },
];

let lk: ImportLookups;
beforeAll(async () => {
  lk = buildImportLookups(await getMasterData(env.DB), OFFICERS);
});

const personal = (over: Partial<ImportRow> = {}): ImportRow => ({
  row_number: 2,
  subject: "Cá nhân",
  officer_code: "CB001",
  unit: "Phòng 6",
  team: "",
  form: "Danh hiệu",
  award_name: "Chiến sĩ thi đua cơ sở",
  year: 2026,
  decision_number: "125/QĐ-ĐV",
  decision_date: "15/09/2026",
  authority: "",
  achievement: "Hoàn thành xuất sắc nhiệm vụ",
  note: "",
  ...over,
});
const collective = (over: Partial<ImportRow> = {}): ImportRow =>
  personal({
    subject: "Tập thể",
    officer_code: "",
    team: "Đội CSGT đường bộ cao tốc số 1",
    form: "Khen thưởng",
    award_name: "Bằng khen Bộ Công an",
    ...over,
  });
const errorsOf = (r: ImportRow) => validateImportRow(r, lk).errors;

describe("validateImportRow happy paths", () => {
  it("personal row builds an AwardInput and defaults authority per spec §2", () => {
    const c = validateImportRow(personal(), lk);
    expect(c.errors).toEqual([]);
    expect(c.input).toMatchObject({
      subject: "CA_NHAN",
      officer_id: 11,
      award_type_id: 7,
      award_variant_id: null,
      authority_id: 4,
      year: 2026,
      decision_date: "2026-09-15",
    });
    expect(c.display.subjectName).toBe("Nguyễn Văn An");
  });

  it("collective row with team, explicit authority", () => {
    const c = validateImportRow(collective({ authority: "bộ trưởng  bộ công an" }), lk);
    expect(c.errors).toEqual([]);
    expect(c.input).toMatchObject({ subject: "TAP_THE", unit_id: 6, team_id: 1, authority_id: 3 });
  });

  it("medal by variant name sets the variant and Chủ tịch nước default", () => {
    const c = validateImportRow(
      personal({ form: "Khen thưởng", award_name: "Huân chương Chiến công hạng Ba" }),
      lk,
    );
    expect(c.input).toMatchObject({ award_type_id: 9, award_variant_id: 6, authority_id: 1 });
  });

  it("unit by code and by messy name (BR-07); officer code case-insensitive", () => {
    expect(validateImportRow(personal({ unit: "p6", officer_code: " cb001 " }), lk).errors).toEqual(
      [],
    );
    expect(validateImportRow(personal({ unit: "  PHÒNG   6 " }), lk).errors).toEqual([]);
    expect(validateImportRow(personal({ unit: "Phòng 6".normalize("NFD") }), lk).errors).toEqual(
      [],
    );
  });

  it.each([
    ["15/09/2026", "2026-09-15"],
    ["2026-09-15", "2026-09-15"],
    ["5/9/2026", "2026-09-05"],
  ])("date %s -> %s", (raw, iso) => {
    expect(validateImportRow(personal({ decision_date: raw }), lk).input).toMatchObject({
      decision_date: iso,
    });
  });
});

describe("validateImportRow messages (spec §5 table, verbatim)", () => {
  it.each<[string, Partial<ImportRow>, string]>([
    ["subject", { subject: "Nhóm" }, "Đối tượng phải là Tập thể hoặc Cá nhân"],
    ["unit unknown", { unit: "Phòng 99" }, 'Không tìm thấy đơn vị "Phòng 99"'],
    ["unit empty", { unit: "" }, "Thiếu đơn vị"],
    [
      "team of another unit",
      { team: "Đội Dẫn đoàn số 1" },
      'Đội "Đội Dẫn đoàn số 1" không thuộc Phòng 6',
    ],
    ["personal without code", { officer_code: "" }, "Cá nhân cần có mã cán bộ"],
    ["officer unknown", { officer_code: "cb999" }, "Không tìm thấy cán bộ mã CB999"],
    [
      "officer of other unit",
      { officer_code: "CB002" },
      "Cán bộ Trần Thị Bình không thuộc Phòng 6",
    ],
    ["form", { form: "Khác" }, "Hình thức phải là Danh hiệu hoặc Khen thưởng"],
    [
      "award wrong for personal title",
      { award_name: "Đơn vị tiên tiến" },
      '"Đơn vị tiên tiến" không phải danh hiệu cá nhân hợp lệ',
    ],
    [
      "award wrong for reward form",
      { form: "Khen thưởng", award_name: "Chiến sĩ tiên tiến" },
      '"Chiến sĩ tiên tiến" không phải hình thức khen thưởng hợp lệ',
    ],
    [
      "medal without variant",
      { form: "Khen thưởng", award_name: "Huân chương" },
      "Ghi rõ loại huân chương, ví dụ Huân chương Chiến công hạng Ba",
    ],
    [
      "unknown medal text",
      { form: "Khen thưởng", award_name: "Huân chương Lao động" },
      "Ghi rõ loại huân chương, ví dụ Huân chương Chiến công hạng Ba",
    ],
    ["award empty", { award_name: "" }, "Thiếu danh hiệu / khen thưởng"],
    ["year text", { year: "abc" }, "Năm không hợp lệ"],
    ["year range", { year: 1989 }, "Năm không hợp lệ"],
    ["decision empty", { decision_number: " " }, "Thiếu số quyết định"],
    ["date format", { decision_date: "2026/09/15" }, "Ngày quyết định phải theo dạng dd/mm/yyyy"],
    ["date 31/02", { decision_date: "31/02/2026" }, "Ngày quyết định phải theo dạng dd/mm/yyyy"],
    ["achievement", { achievement: "" }, "Thiếu chi tiết giải thưởng"],
    ["authority unknown", { authority: "Ai đó" }, 'Không tìm thấy cấp quyết định "Ai đó"'],
  ])("%s", (_name, over, message) => {
    const c = validateImportRow(personal(over), lk);
    expect(c.errors).toContain(message);
    expect(c.input).toBeNull();
  });

  it("officer outside the given team", () => {
    expect(errorsOf(personal({ team: "Đội CSGT đường bộ cao tốc số 2" }))).toContain(
      "Cán bộ Nguyễn Văn An không thuộc Đội CSGT đường bộ cao tốc số 2",
    );
  });

  it("medal under Danh hiệu form is rejected with the form hint", () => {
    expect(errorsOf(personal({ award_name: "Huân chương Chiến công hạng Ba" }))).toContain(
      "Huân chương thuộc hình thức Khen thưởng",
    );
  });

  it("collects every error of a row; collective ignores the officer code", () => {
    expect(errorsOf(personal({ unit: "x", year: "", decision_number: "" })).length).toBe(3);
    expect(validateImportRow(collective({ officer_code: "ZZZ" }), lk).errors).toEqual([]);
  });
});
