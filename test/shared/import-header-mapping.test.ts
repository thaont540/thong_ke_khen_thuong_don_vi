import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { mapImportHeaders } from "../../src/shared/import/import-column-definitions";
import {
  findIntraFileDuplicates,
  intraFileMessage,
} from "../../src/shared/import/import-duplicate-identity";
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

describe("header mapping and intra-file duplicates", () => {
  it("lists missing required column names, ignores case and spacing", () => {
    const m = mapImportHeaders(["đối tượng", " Đơn  vị ", "Năm"]);
    expect(m.missing).toEqual([
      "Mã cán bộ",
      "Hình thức",
      "Danh hiệu / khen thưởng",
      "Số quyết định",
      "Ngày quyết định",
      "Chi tiết giải thưởng",
    ]);
    expect(m.indexes.unit).toBe(1);
  });

  it("flags a row against all earlier valid rows with the same identity", () => {
    const a = validateImportRow(personal({ row_number: 2 }), lk);
    const b = validateImportRow(personal({ row_number: 3, decision_number: "9/QĐ" }), lk);
    const c = validateImportRow(personal({ row_number: 4 }), lk);
    const other = validateImportRow(personal({ row_number: 5, year: 2025 }), lk);
    const bad = validateImportRow(personal({ row_number: 6, unit: "x" }), lk);
    const map = findIntraFileDuplicates(
      [a, b, c, other, bad].map((x, i) => ({ row_number: i + 2, input: x.input })),
    );
    expect(map.get(2)).toBeUndefined();
    expect(map.get(3)).toEqual([2]);
    expect(map.get(4)).toEqual([2, 3]);
    expect(map.has(5) || map.has(6)).toBe(false);
    expect(intraFileMessage([2, 3])).toBe("Trùng với dòng 2, 3 trong file");
  });
});
