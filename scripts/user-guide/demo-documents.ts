/** Fake regulation documents + synthetic file bodies (valid magic bytes, padded to a realistic size). */
export interface DemoDocument {
  number: string;
  title: string;
  type: "LUAT" | "NGHI_DINH" | "THONG_TU" | "QUYET_DINH" | "HUONG_DAN";
  issuer: string;
  date: string;
  status: "CON_HIEU_LUC" | "HET_HIEU_LUC";
  note: string;
  file: string;
  mime: string;
  /** First bytes must match the real format (the API sniffs them); the rest is padding. */
  magic: number[];
  kb: number;
}

const PDF = { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] };
const DOCX = {
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  magic: [0x50, 0x4b, 0x03, 0x04],
};

/** Fake regulations (numbers and titles are invented for the demo). */
export const DEMO_DOCUMENTS: readonly DemoDocument[] = [
  {
    number: "98/2026/NĐ-CP",
    title: "Nghị định chi tiết thi hành Luật Thi đua, khen thưởng (minh họa)",
    type: "NGHI_DINH",
    issuer: "Chính phủ",
    date: "2026-03-12",
    status: "CON_HIEU_LUC",
    note: "Văn bản minh họa",
    file: "nghi-dinh-98-2026.pdf",
    kb: 1480,
    ...PDF,
  },
  {
    number: "45/2026/TT-BCA",
    title: "Thông tư hướng dẫn công tác thi đua, khen thưởng (minh họa)",
    type: "THONG_TU",
    issuer: "Bộ Công an",
    date: "2026-06-20",
    status: "CON_HIEU_LUC",
    note: "",
    file: "thong-tu-45-2026.pdf",
    kb: 920,
    ...PDF,
  },
  {
    number: "12/QĐ-C08",
    title: "Quy chế thi đua, khen thưởng của Cục CSGT (minh họa)",
    type: "QUYET_DINH",
    issuer: "Cục Cảnh sát giao thông",
    date: "2026-09-05",
    status: "CON_HIEU_LUC",
    note: "Áp dụng từ 01/10/2026",
    file: "quyet-dinh-12-c08.docx",
    kb: 310,
    ...DOCX,
  },
  {
    number: "15/2022/TT-BCA",
    title: "Thông tư tiêu chuẩn xếp loại cán bộ hằng năm (minh họa)",
    type: "THONG_TU",
    issuer: "Bộ Công an",
    date: "2022-02-18",
    status: "HET_HIEU_LUC",
    note: "Thay thế bởi Thông tư 45/2026/TT-BCA",
    file: "thong-tu-15-2022.pdf",
    kb: 640,
    ...PDF,
  },
];

export const fileBuffer = (d: DemoDocument): Buffer => {
  const buf = Buffer.alloc(d.kb * 1024, 0x20);
  Buffer.from(d.magic).copy(buf);
  return buf;
};
