import type { ImportRow } from "../../../src/shared/schemas/award-import-schemas";

/** Raw import row as the browser would send it: personal CSTD cơ sở for officer "Cán bộ 1" of Phòng 6. */
export const importRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow => ({
  row_number: rowNumber,
  subject: "Cá nhân",
  full_name: "Cán bộ 1",
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

export const importCollectiveRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow =>
  importRow(rowNumber, {
    subject: "Tập thể",
    full_name: "",
    rank: "",
    position: "",
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
    new_officer?: boolean;
    award_id?: number;
  }[];
}

/** Personal row of a person who does not exist yet ("Nguyễn Văn Mới", Phòng 6). */
export const newbieRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow =>
  importRow(rowNumber, { full_name: "Nguyễn Văn Mới", ...over });

/** Xếp loại cán bộ row of officer "Cán bộ 1" (Hoàn thành xuất sắc nhiệm vụ, 2026). */
export const ratingRow = (rowNumber: number, over: Partial<ImportRow> = {}): ImportRow =>
  importRow(rowNumber, {
    form: "Xếp loại cán bộ",
    award_name: "Hoàn thành xuất sắc nhiệm vụ",
    ...over,
  });
