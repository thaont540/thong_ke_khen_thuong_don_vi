import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildImportLookups,
  type ImportLookups,
  type ImportOfficer,
} from "../../src/shared/import/import-lookup-maps";
import { validateImportRow } from "../../src/shared/import/import-row-validator";
import { validateImportRows } from "../../src/shared/import/import-rows-validator";
import type { ImportRow } from "../../src/shared/schemas/award-import-schemas";
import { getMasterData } from "../../src/worker/services/master-data-service";

const OFFICERS: ImportOfficer[] = [
  { id: 11, full_name: "Nguyễn Văn An", unit_id: 6, team_id: 1 },
  { id: 12, full_name: "Trần Thị Bình", unit_id: 5, team_id: null },
  { id: 13, full_name: "Lê Văn Trùng", unit_id: 6, team_id: 1 },
  { id: 14, full_name: "Lê Văn Trùng", unit_id: 6, team_id: 2 },
  { id: 15, full_name: "Phạm Văn Một", unit_id: 6, team_id: 2 },
];

let lk: ImportLookups;
beforeAll(async () => {
  lk = buildImportLookups(await getMasterData(env.DB), OFFICERS);
});

const personal = (over: Partial<ImportRow> = {}): ImportRow => ({
  row_number: 2,
  subject: "Cá nhân",
  full_name: "Nguyễn Văn An",
  rank: "Đại úy",
  position: "Cán bộ",
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
const rating = (over: Partial<ImportRow> = {}): ImportRow =>
  personal({ form: "Xếp loại cán bộ", award_name: "Hoàn thành xuất sắc nhiệm vụ", ...over });
const check = (over: Partial<ImportRow>) => validateImportRow(personal(over), lk);

describe("officer resolution by name + unit (+ team)", () => {
  it("one match with the team given or blank (any team of the unit)", () => {
    expect(check({ team: "Đội CSGT đường bộ cao tốc số 1" }).input).toMatchObject({
      officer_id: 11,
    });
    const c = check({ full_name: "phạm  văn MỘT" });
    expect(c.input).toMatchObject({ officer_id: 15 });
    expect(c.newOfficer).toBeNull();
    expect(c.display.subjectName).toBe("Phạm Văn Một");
  });

  it("existing officer: rank and position in the file are informational only", () => {
    const c = check({ rank: "không có", position: "" });
    expect(c.errors).toEqual([]);
    expect(c.input).toMatchObject({ officer_id: 11 });
  });

  it("several officers with the name: error, no auto-pick; the team narrows it down", () => {
    const c = check({ full_name: "Lê Văn Trùng" });
    expect(c.errors).toEqual([
      'Có 2 cán bộ trùng tên "Lê Văn Trùng" trong Phòng 6 — vui lòng kiểm tra',
    ]);
    expect(c.input).toBeNull();
    const narrowed = check({ full_name: "Lê Văn Trùng", team: "Đội CSGT đường bộ cao tốc số 2" });
    expect(narrowed.input).toMatchObject({ officer_id: 14 });
  });

  it("unknown name or same name in another unit: new officer, team NULL when Đội is blank", () => {
    for (const over of [{ full_name: "Người Mới" }, { full_name: "Trần Thị Bình" }]) {
      const c = check(over);
      expect(c.errors).toEqual([]);
      expect(c.newOfficer).toMatchObject({ unit_id: 6, team_id: null, rank_id: 7, position_id: 7 });
      expect(c.input?.subject === "CA_NHAN" && c.input.officer_id).toBeLessThan(0);
      expect(c.display.subjectName).toBe(over.full_name);
    }
  });

  it("new officer takes the team of the row; Đội of another unit is still an error", () => {
    const c = check({ full_name: "Người Mới", team: "Đội CSGT đường bộ cao tốc số 3" });
    expect(c.newOfficer).toMatchObject({ unit_id: 6, team_id: 3 });
    expect(check({ full_name: "Người Mới", team: "Đội Dẫn đoàn số 1" }).errors).toEqual([
      'Đội "Đội Dẫn đoàn số 1" không thuộc Phòng 6',
    ]);
  });

  it("the same new person in several rows is registered once (shared temp id)", () => {
    const rows = [
      personal({ row_number: 2, full_name: "Người Mới" }),
      personal({ row_number: 3, full_name: " NGƯỜI  mới ", year: 2025 }),
      personal({ row_number: 4, full_name: "Người Mới", team: "Đội CSGT đường bộ cao tốc số 3" }),
    ];
    const [a, b, c] = validateImportRows(rows, lk);
    expect(a?.errors).toEqual([]);
    expect(b?.newOfficer?.temp_id).toBe(a?.newOfficer?.temp_id);
    expect(c?.newOfficer?.temp_id).not.toBe(a?.newOfficer?.temp_id);
  });

  it("Cục unit by name or code C08 with Cục trưởng; collective in the Cục", () => {
    const byName = check({
      full_name: "Người Mới",
      unit: "Cục Cảnh sát giao thông",
      position: "Cục trưởng",
    });
    const byCode = check({ full_name: "Người Mới", unit: "c08", position: "Phó Cục trưởng" });
    expect(byName.errors).toEqual([]);
    expect(byCode.errors).toEqual([]);
    expect(byName.newOfficer?.unit_id).toBe(byCode.newOfficer?.unit_id);
    const collective = personal({
      subject: "Tập thể",
      full_name: "",
      rank: "",
      position: "",
      unit: "C08",
      form: "Khen thưởng",
      award_name: "Bằng khen Bộ Công an",
    });
    expect(validateImportRow(collective, lk).errors).toEqual([]);
  });
});

describe("Xếp loại cán bộ rows", () => {
  it("valid rating defaults to the Cục trưởng Cục CSGT authority", () => {
    const c = validateImportRow(rating(), lk);
    expect(c.errors).toEqual([]);
    const authority = lk.master.authorities.find((a) => a.name === "Cục trưởng Cục CSGT");
    expect(c.input).toMatchObject({ officer_id: 11, authority_id: authority?.id, year: 2026 });
    expect(c.display.form).toBe("XEP_LOAI");
  });

  it("only individuals; the rating name must be a rating", () => {
    const team = rating({ subject: "Tập thể", full_name: "", rank: "", position: "" });
    expect(validateImportRow(team, lk).errors).toEqual(["Xếp loại cán bộ chỉ áp dụng cho cá nhân"]);
    expect(validateImportRow(rating({ award_name: "Giấy khen" }), lk).errors).toEqual([
      '"Giấy khen" không phải xếp loại cán bộ hợp lệ',
    ]);
    // A rating name under Danh hiệu is not a title.
    expect(check({ award_name: "Hoàn thành tốt nhiệm vụ" }).errors).toEqual([
      '"Hoàn thành tốt nhiệm vụ" không phải danh hiệu cá nhân hợp lệ',
    ]);
  });

  it("a second rating of the same officer and year in the file is an error, another year is fine", () => {
    const rows = [
      rating({ row_number: 2 }),
      rating({ row_number: 3, award_name: "Hoàn thành tốt nhiệm vụ" }),
      rating({ row_number: 4, year: 2025 }),
      rating({ row_number: 5, full_name: "Người Mới" }),
      rating({ row_number: 6, full_name: "Người Mới" }),
    ];
    const checks = validateImportRows(rows, lk);
    expect(checks.map((c) => c.errors)).toEqual([
      [],
      ["Cán bộ đã có xếp loại năm 2026 (trùng với dòng 2 trong file)"],
      [],
      [],
      ["Cán bộ đã có xếp loại năm 2026 (trùng với dòng 5 trong file)"],
    ]);
    expect(checks[1]?.input).toBeNull();
  });
});
