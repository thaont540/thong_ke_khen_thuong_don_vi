import type { DocumentItem } from "../../../src/shared/schemas/document-schemas";
import { makeMe } from "./render-with-providers";

export const doc = (over: Partial<DocumentItem> = {}): DocumentItem => ({
  id: 5,
  doc_number: "12/2026/NĐ-CP",
  title: "Quy định về thi đua, khen thưởng",
  doc_type: "NGHI_DINH",
  issuer: "Chính phủ",
  issued_date: "2026-03-15",
  status: "CON_HIEU_LUC",
  note: null,
  file_name: "nghi-dinh-12.pdf",
  content_type: "application/pdf",
  size_bytes: 1536,
  created_at: "2026-10-19 08:00:00",
  updated_at: "2026-10-19 08:00:00",
  ...over,
});

export const listOf = (items: DocumentItem[], total = items.length) => ({
  body: { items, total, page: 1, size: 10 },
});

export const withRole = (role: "ADMIN" | "EDITOR" | "VIEWER") => ({
  "GET /api/me": { body: makeMe(role) },
});

/** A File whose reported size differs from its content (avoids allocating 20 MB in tests). */
export function fileOfSize(name: string, type: string, size: number): File {
  const f = new File(["%PDF-1"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}
