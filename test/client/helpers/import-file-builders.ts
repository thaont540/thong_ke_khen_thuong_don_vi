import * as XLSX from "xlsx";
import { IMPORT_COLUMNS } from "../../../src/shared/import/import-column-definitions";

export const HEADERS = IMPORT_COLUMNS.map((c) => c.header);
type Cell = string | number | null;

/** Personal CSTD cơ sở row for officer Nguyễn Văn An of Phòng 6 (see award-fixtures), in the sheet column order. */
export const sheetRow = (over: Partial<Record<(typeof HEADERS)[number], Cell>> = {}): Cell[] => {
  const base: Record<string, Cell> = {
    "Đối tượng": "Cá nhân",
    "Họ và tên": "Nguyễn Văn An",
    "Cấp bậc": "Đại úy",
    "Chức vụ": "Cán bộ",
    "Đơn vị": "Phòng 6",
    Đội: "",
    "Hình thức": "Danh hiệu",
    "Danh hiệu / khen thưởng": "Chiến sĩ thi đua cơ sở",
    Năm: 2026,
    "Số quyết định": "125/QĐ-ĐV",
    "Ngày quyết định": "15/09/2026",
    "Cấp quyết định": "",
    "Chi tiết giải thưởng": "Hoàn thành xuất sắc nhiệm vụ",
    "Ghi chú": "",
    ...over,
  };
  return HEADERS.map((h) => base[h] ?? "");
};

const TYPE = "application/octet-stream";

/** In-memory .xlsx (first sheet = aoa) wrapped in a File, as the browser file input would give. */
export function xlsxFile(aoa: Cell[][], name = "khen-thuong.xlsx"): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Khen thưởng");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([bytes], name, { type: TYPE });
}

export const csvFile = (lines: string[][], name = "khen-thuong.csv"): File =>
  new File([lines.map((l) => l.join(",")).join("\n")], name, { type: "text/csv" });

/** Workbook with a real date-formatted numeric cell (what Excel stores) in "Ngày quyết định". */
export function xlsxFileWithExcelDate(isoY: number, isoM: number, isoD: number): File {
  const aoa = [HEADERS, sheetRow({ "Ngày quyết định": null })];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const col = HEADERS.indexOf("Ngày quyết định");
  const serial = (Date.UTC(isoY, isoM - 1, isoD) - Date.UTC(1899, 11, 30)) / 86_400_000;
  ws[XLSX.utils.encode_cell({ r: 1, c: col })] = { t: "n", v: serial, z: "dd/mm/yyyy" };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([bytes], "excel-date.xlsx", { type: TYPE });
}
