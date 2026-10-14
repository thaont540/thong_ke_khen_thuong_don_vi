import type { ImportRow } from "../../../src/shared/schemas/award-import-schemas";

/** Raw import row as the browser would send it: personal CSTD cơ sở for officer CB00<n> of Phòng 6. */
export const importRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow => ({
  row_number: rowNumber,
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

export const importCollectiveRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow =>
  importRow(rowNumber, {
    subject: "Tập thể",
    officer_code: "",
    team: "Đội CSGT đường bộ cao tốc số 1",
    form: "Khen thưởng",
    award_name: "Bằng khen Bộ Công an",
    ...over,
  });

export const importBody = (rows: ImportRow[], over: Record<string, unknown> = {}) => ({
  file_name: "khen-thuong.xlsx",
  total_rows: rows.length,
  include_duplicates: false,
  rows,
  ...over,
});

export interface LotResponse {
  batch_id: number | null;
  imported_count: number;
  results: {
    row_number: number;
    status: "OK" | "ERROR" | "DUPLICATE";
    errors: string[];
    duplicate_messages: string[];
    imported: boolean;
    award_id?: number;
  }[];
}
