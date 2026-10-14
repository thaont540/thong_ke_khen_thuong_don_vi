import { mapImportHeaders, toImportRow } from "../../../../shared/import/import-column-definitions";
import {
  IMPORT_CELL_MAX,
  IMPORT_MAX_ROWS,
  type ImportRow,
} from "../../../../shared/schemas/award-import-schemas";

/** SheetJS is ~400 KB: loaded on first use only, so it stays out of the main bundle. */
export const loadXlsx = () => import("xlsx");
type Xlsx = Awaited<ReturnType<typeof loadXlsx>>;

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = /\.(xlsx|xls|csv)$/i;

/** User-facing failure while reading a file (message is shown as is). */
export class ImportFileError extends Error {}

export interface ParsedImportFile {
  rows: ImportRow[];
  warnings: string[];
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Cell -> text. Date-formatted numbers become ISO dates (no time zone involved); formulas give cached values. */
function cellText(XLSX: Xlsx, cell: import("xlsx").CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (cell.t === "e") return "";
  let text: string;
  if (cell.t === "n" && typeof cell.v === "number" && cell.z && XLSX.SSF.is_date(cell.z)) {
    const d = XLSX.SSF.parse_date_code(cell.v);
    text = d ? `${String(d.y).padStart(4, "0")}-${pad2(d.m)}-${pad2(d.d)}` : String(cell.v);
  } else if (cell.v instanceof Date) {
    text = `${cell.v.getFullYear()}-${pad2(cell.v.getMonth() + 1)}-${pad2(cell.v.getDate())}`;
  } else {
    text = String(cell.v);
  }
  return text.slice(0, IMPORT_CELL_MAX);
}

function sheetRows(XLSX: Xlsx, ws: import("xlsx").WorkSheet): string[][] {
  if (!ws["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cells.push(cellText(XLSX, ws[XLSX.utils.encode_cell({ r, c })]));
    }
    rows.push(cells);
  }
  return rows;
}

/** Parses the first sheet of a workbook into raw import rows (header row = first row). */
export async function parseImportContent(
  content: { kind: "csv"; text: string } | { kind: "binary"; buffer: ArrayBuffer },
  fileName: string,
): Promise<ParsedImportFile> {
  const XLSX = await loadXlsx();
  let ws: import("xlsx").WorkSheet | undefined;
  try {
    const wb =
      content.kind === "csv"
        ? XLSX.read(content.text, { type: "string", raw: true })
        : XLSX.read(content.buffer, { type: "array", cellNF: true });
    ws = wb.Sheets[wb.SheetNames[0] ?? ""];
  } catch {
    throw new ImportFileError(
      `Không đọc được file "${fileName}". Kiểm tra file có đúng định dạng Excel hoặc CSV.`,
    );
  }
  const all = ws ? sheetRows(XLSX, ws) : [];
  const [header, ...body] = all;
  if (!header) throw new ImportFileError(`File "${fileName}" không có dữ liệu ở sheet đầu tiên.`);

  const mapping = mapImportHeaders(header);
  if (mapping.missing.length > 0) {
    throw new ImportFileError(
      `File thiếu cột: ${mapping.missing.join(", ")}. Hãy dùng file mẫu để có đúng tên cột.`,
    );
  }
  const rows = body.flatMap((cells, i) =>
    cells.some((c) => c.trim() !== "") ? [toImportRow(cells, mapping, i + 2)] : [],
  );
  if (rows.length === 0) {
    throw new ImportFileError(`File "${fileName}" không có dòng dữ liệu nào ở sheet đầu tiên.`);
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `File có ${rows.length} dòng, vượt giới hạn ${IMPORT_MAX_ROWS.toLocaleString("vi-VN")} dòng. Hãy chia nhỏ file.`,
    );
  }
  return { rows, warnings: [] };
}

/** Size/extension checks, then reads the file (CSV as UTF-8, others as binary workbook). */
export async function readImportFile(file: File): Promise<ParsedImportFile> {
  if (!ALLOWED_EXT.test(file.name)) {
    throw new ImportFileError("Chỉ hỗ trợ file .xlsx, .xls hoặc .csv.");
  }
  if (file.size > IMPORT_MAX_BYTES) {
    throw new ImportFileError("File vượt quá 5 MB. Hãy chia nhỏ file.");
  }
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    const parsed = await parseImportContent({ kind: "csv", text }, file.name);
    if (text.includes("�")) {
      parsed.warnings.push(
        "File CSV có ký tự lỗi, hãy lưu lại dưới dạng UTF-8 nếu tiếng Việt bị sai.",
      );
    }
    return parsed;
  }
  return parseImportContent({ kind: "binary", buffer: await file.arrayBuffer() }, file.name);
}
