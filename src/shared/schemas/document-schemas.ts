import { z } from "zod";
import { isValidIsoDate } from "../date-format";
import { collapseSpaces } from "../normalize-text";
import { idSchema, optionalTextParam, pageSchema } from "./api-common-schemas";
import { paginationQuerySchema } from "./list-query-schemas";

export const DOC_TYPES = [
  "LUAT",
  "NGHI_DINH",
  "THONG_TU",
  "QUYET_DINH",
  "HUONG_DAN",
  "KHAC",
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_STATUSES = ["CON_HIEU_LUC", "HET_HIEU_LUC"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  LUAT: "Luật",
  NGHI_DINH: "Nghị định",
  THONG_TU: "Thông tư",
  QUYET_DINH: "Quyết định",
  HUONG_DAN: "Hướng dẫn",
  KHAC: "Khác",
};
export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  CON_HIEU_LUC: "Còn hiệu lực",
  HET_HIEU_LUC: "Hết hiệu lực",
};

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

const OFFICE_ZIP = ["application/zip", "application/x-zip-compressed"] as const;
/** Allowed extensions -> canonical MIME (served on download) + accepted upload MIME types. */
export const DOCUMENT_FILE_TYPES = {
  pdf: { mime: "application/pdf", accepts: ["application/pdf"] },
  doc: { mime: "application/msword", accepts: ["application/msword"] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    accepts: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ...OFFICE_ZIP,
    ],
  },
  xls: {
    mime: "application/vnd.ms-excel",
    accepts: ["application/vnd.ms-excel", "application/msexcel", "application/x-msexcel"],
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accepts: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ...OFFICE_ZIP],
  },
} as const;
export type DocumentExt = keyof typeof DOCUMENT_FILE_TYPES;
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_FILE_TYPES)
  .map((e) => `.${e}`)
  .join(",");

export const documentExtension = (fileName: string): DocumentExt | null => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return fileName.includes(".") && ext in DOCUMENT_FILE_TYPES ? (ext as DocumentExt) : null;
};

/** Shared by client (early feedback) and server: returns a Vietnamese message, or null when OK. */
export function documentFileProblem(f: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (f.size <= 0) return "Tệp rỗng";
  if (f.size > DOCUMENT_MAX_BYTES) return "Tệp vượt quá 20 MB";
  const ext = documentExtension(f.name);
  if (!ext) return "Chỉ chấp nhận tệp PDF, DOC, DOCX, XLS, XLSX";
  const type = f.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const accepts: readonly string[] = DOCUMENT_FILE_TYPES[ext].accepts;
  // Browsers/OSes often leave the type empty or generic; the server also checks magic bytes.
  if (type !== "" && type !== "application/octet-stream" && !accepts.includes(type)) {
    return "Loại tệp không khớp với phần mở rộng";
  }
  return null;
}

const text = (max: number) =>
  z.string().transform(collapseSpaces).pipe(z.string().min(1, "Bắt buộc nhập").max(max));

/** Metadata fields of POST/PUT /api/documents (sent as multipart text parts next to `file`). */
export const documentInputSchema = z.object({
  doc_number: text(100),
  title: text(1000),
  doc_type: z.enum(DOC_TYPES),
  issuer: text(200),
  issued_date: z.string().refine(isValidIsoDate, "Ngày ban hành không hợp lệ"),
  status: z.enum(DOC_STATUSES).default("CON_HIEU_LUC"),
  note: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

export const documentListQuerySchema = paginationQuerySchema.extend({
  q: optionalTextParam,
  doc_type: z.preprocess((v) => (v === "" ? undefined : v), z.enum(DOC_TYPES).optional()),
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(DOC_STATUSES).optional()),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

export const documentItemSchema = z.object({
  id: idSchema,
  doc_number: z.string(),
  title: z.string(),
  doc_type: z.enum(DOC_TYPES),
  issuer: z.string(),
  issued_date: z.string(),
  status: z.enum(DOC_STATUSES),
  note: z.string().nullable(),
  file_name: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DocumentItem = z.infer<typeof documentItemSchema>;
export const documentListResponseSchema = pageSchema(documentItemSchema);
