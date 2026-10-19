/**
 * Builds the demo .xlsx used for the import screenshots (14-column template of CR 19/10/2026: name,
 * rank and position instead of the officer code): valid rows (existing officer, new officer, xếp loại,
 * tập thể), duplicate rows and invalid rows.
 */
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

const TEAM_6_2 = "Đội CSGT đường bộ cao tốc số 2";
const TEAM_6_3 = "Đội CSGT đường bộ cao tốc số 3";
const tung = {
  "Họ và tên": "Phạm Thanh Tùng",
  "Cấp bậc": "Thượng úy",
  "Chức vụ": "Cán bộ",
  Đội: TEAM_6_2,
};
const dat = {
  "Họ và tên": "Nguyễn Hữu Đạt",
  "Cấp bậc": "Trung úy",
  "Chức vụ": "Cán bộ",
  Đội: TEAM_6_3,
};

const ROWS: Cell[][] = [
  // Existing officer (matched by name + unit + team).
  row({ ...tung, "Số quyết định": "140/QĐ-P6" }),
  // Officer not in the system yet -> created on commit ("mới" badge).
  row({
    ...dat,
    "Hình thức": "Khen thưởng",
    "Danh hiệu / khen thưởng": "Giấy khen",
    "Số quyết định": "141/QĐ-P6",
  }),
  // Yearly rating (Xếp loại cán bộ): default authority = Cục trưởng Cục CSGT.
  row({
    ...tung,
    "Hình thức": "Xếp loại cán bộ",
    "Danh hiệu / khen thưởng": "Hoàn thành tốt nhiệm vụ",
    "Số quyết định": "09/QĐ-C08",
    "Ngày quyết định": "30/12/2026",
    "Chi tiết giải thưởng": "Xếp loại cán bộ năm 2026",
  }),
  row({
    "Đối tượng": "Tập thể",
    "Đơn vị": "Phòng 7",
    Đội: "Đội Dẫn đoàn số 2",
    "Danh hiệu / khen thưởng": "Đơn vị tiên tiến",
    "Số quyết định": "142/QĐ-P7",
  }),
  row({
    "Họ và tên": "Ngô Thị Phương",
    "Cấp bậc": "Thượng úy",
    "Chức vụ": "Cán bộ",
    "Đơn vị": "Phòng 7",
    Đội: "Đội Dẫn đoàn số 2",
    "Hình thức": "Khen thưởng",
    "Danh hiệu / khen thưởng": "Huân chương Chiến công hạng Ba",
    "Số quyết định": "143/QĐ-CTN",
  }),
  // Same officer, title and year as a stored award -> "Có thể trùng".
  row({
    "Họ và tên": "Nguyễn Văn Hùng",
    "Cấp bậc": "Thiếu tá",
    "Chức vụ": "Đội trưởng",
    Đội: "Đội CSGT đường bộ cao tốc số 1",
    "Số quyết định": "144/QĐ-P6",
  }),
  // Same as the first row -> duplicate inside the file.
  row({ ...tung, "Số quyết định": "145/QĐ-P6" }),
  // New officer with a rank that is not in the catalog -> error.
  row({
    "Họ và tên": "Lê Văn Thử",
    "Cấp bậc": "Đại hiệp",
    "Chức vụ": "Cán bộ",
    "Số quyết định": "146/QĐ-P6",
  }),
  // Officer who already has a 2025 rating -> error (one rating per officer per year).
  row({
    "Họ và tên": "Lê Quang Minh",
    "Cấp bậc": "Thiếu tá",
    "Chức vụ": "Phó Đội trưởng",
    Đội: TEAM_6_2,
    Năm: 2025,
    "Hình thức": "Xếp loại cán bộ",
    "Danh hiệu / khen thưởng": "Hoàn thành xuất sắc nhiệm vụ",
    "Số quyết định": "10/QĐ-C08",
    "Ngày quyết định": "30/12/2025",
    "Chi tiết giải thưởng": "Xếp loại cán bộ năm 2025",
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
