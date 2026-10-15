/** Builds the demo .xlsx used for the import screenshots: valid, duplicate and invalid rows. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  IMPORT_COLUMNS,
  TEMPLATE_MAIN_SHEET,
} from "../../src/shared/import/import-column-definitions";

const HEADERS = IMPORT_COLUMNS.map((c) => c.header);
type Cell = string | number;

function row(over: Record<string, Cell>): Cell[] {
  const base: Record<string, Cell> = {
    "Đối tượng": "Cá nhân",
    "Mã cán bộ": "",
    "Đơn vị": "Phòng 6",
    "Hình thức": "Danh hiệu",
    "Danh hiệu / khen thưởng": "Chiến sĩ thi đua cơ sở",
    Năm: 2026,
    "Ngày quyết định": "15/09/2026",
    "Chi tiết giải thưởng": "Hoàn thành xuất sắc nhiệm vụ năm 2026",
  };
  const merged = { ...base, ...over };
  return HEADERS.map((h) => merged[h] ?? "");
}

const ROWS: Cell[][] = [
  row({ "Mã cán bộ": "CB004", "Số quyết định": "140/QĐ-P6" }),
  row({
    "Mã cán bộ": "CB006",
    "Hình thức": "Khen thưởng",
    "Danh hiệu / khen thưởng": "Giấy khen",
    "Số quyết định": "141/QĐ-P6",
  }),
  row({
    "Đối tượng": "Tập thể",
    "Đơn vị": "Phòng 7",
    Đội: "Đội Dẫn đoàn số 2",
    "Danh hiệu / khen thưởng": "Đơn vị tiên tiến",
    "Số quyết định": "142/QĐ-P7",
  }),
  row({
    "Mã cán bộ": "CB009",
    "Đơn vị": "Phòng 7",
    "Hình thức": "Khen thưởng",
    "Danh hiệu / khen thưởng": "Huân chương Chiến công hạng Ba",
    "Số quyết định": "143/QĐ-CTN",
  }),
  // Same officer, title and year as a stored award -> "Có thể trùng".
  row({ "Mã cán bộ": "CB001", "Số quyết định": "144/QĐ-P6" }),
  // Same as the first row -> duplicate inside the file.
  row({ "Mã cán bộ": "CB004", "Số quyết định": "145/QĐ-P6" }),
  // Unknown officer code -> error.
  row({ "Mã cán bộ": "CB999", "Số quyết định": "146/QĐ-P6" }),
  // Title that is not a personal title + wrong date format -> two errors.
  row({
    "Mã cán bộ": "CB003",
    "Danh hiệu / khen thưởng": "Cờ thi đua của Bộ Công an",
    "Số quyết định": "147/QĐ-P6",
    "Ngày quyết định": "ngày 15 tháng 9",
  }),
];

/** Writes the workbook into a fresh temp dir and returns its path. */
export function writeDemoImportFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "user-guide-import-"));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_MAIN_SHEET);
  const file = join(dir, "khen-thuong-demo.xlsx");
  writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
  return file;
}
