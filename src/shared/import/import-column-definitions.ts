import { normalizeText } from "../normalize-text";
import type { ImportRow } from "../schemas/award-import-schemas";

/** Cell-text fields of one import row (everything except the row number). */
export type ImportColumnKey = Exclude<keyof ImportRow, "row_number">;

export interface ImportColumn {
  key: ImportColumnKey;
  /** Header text of sheet "Khen thưởng" (identical to docs/import-template.xlsx). */
  header: string;
  /** Column must exist in the file; the cell itself may still be optional (e.g. Mã cán bộ for Tập thể). */
  required: boolean;
}

export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "subject", header: "Đối tượng", required: true },
  { key: "officer_code", header: "Mã cán bộ", required: true },
  { key: "unit", header: "Đơn vị", required: true },
  { key: "team", header: "Đội", required: false },
  { key: "form", header: "Hình thức", required: true },
  { key: "award_name", header: "Danh hiệu / khen thưởng", required: true },
  { key: "year", header: "Năm", required: true },
  { key: "decision_number", header: "Số quyết định", required: true },
  { key: "decision_date", header: "Ngày quyết định", required: true },
  { key: "authority", header: "Cấp quyết định", required: false },
  { key: "achievement", header: "Chi tiết giải thưởng", required: true },
  { key: "note", header: "Ghi chú", required: false },
];

export const TEMPLATE_MAIN_SHEET = "Khen thưởng";
export const TEMPLATE_CATALOG_SHEET = "Danh mục";

/** Header row of sheet "Danh mục" (valid values; informational, never parsed). */
export const CATALOG_HEADERS = [
  "Đối tượng",
  "Hình thức",
  "Danh hiệu tập thể",
  "Danh hiệu cá nhân",
  "Hình thức khen thưởng",
  "Đơn vị",
  "Đội (Đơn vị: Đội)",
  "Mã cán bộ",
  "Họ tên",
] as const;

export interface HeaderMapping {
  /** Column index in the sheet per field (absent when the optional column is missing). */
  indexes: Partial<Record<ImportColumnKey, number>>;
  /** Headers of required columns not found in the file. */
  missing: string[];
}

/** Maps header cells to fields by BR-07 normalized text (case, spacing, Unicode form tolerant). */
export function mapImportHeaders(headerCells: readonly string[]): HeaderMapping {
  const byText = new Map<string, number>();
  headerCells.forEach((cell, i) => {
    const key = normalizeText(cell);
    if (key && !byText.has(key)) byText.set(key, i);
  });
  const indexes: HeaderMapping["indexes"] = {};
  const missing: string[] = [];
  for (const col of IMPORT_COLUMNS) {
    const idx = byText.get(normalizeText(col.header));
    if (idx !== undefined) indexes[col.key] = idx;
    else if (col.required) missing.push(col.header);
  }
  return { indexes, missing };
}

/** Builds a raw row from a sheet row using the header mapping (missing optional columns -> ""). */
export function toImportRow(
  cells: readonly string[],
  mapping: HeaderMapping,
  rowNumber: number,
): ImportRow {
  const get = (key: ImportColumnKey): string => {
    const idx = mapping.indexes[key];
    return idx === undefined ? "" : (cells[idx] ?? "");
  };
  return {
    row_number: rowNumber,
    subject: get("subject"),
    officer_code: get("officer_code"),
    unit: get("unit"),
    team: get("team"),
    form: get("form"),
    award_name: get("award_name"),
    year: get("year"),
    decision_number: get("decision_number"),
    decision_date: get("decision_date"),
    authority: get("authority"),
    achievement: get("achievement"),
    note: get("note"),
  };
}
