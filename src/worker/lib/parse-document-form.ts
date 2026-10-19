import type { Context } from "hono";
import {
  type DocumentExt,
  type DocumentInput,
  documentExtension,
  documentFileProblem,
  documentInputSchema,
} from "../../shared/schemas/document-schemas";
import { AppError } from "./app-error";
import { matchesMagicBytes } from "./document-file-check";

export interface UploadedFile {
  name: string;
  ext: DocumentExt;
  bytes: ArrayBuffer;
}

const FIELDS = ["doc_number", "title", "doc_type", "issuer", "issued_date", "status", "note"];
const MAX_FILE_NAME = 255;

async function readFile(file: File): Promise<UploadedFile> {
  const problem = documentFileProblem({ name: file.name, size: file.size, type: file.type });
  if (problem) throw AppError.validation(problem, { file: problem });
  const ext = documentExtension(file.name) as DocumentExt;
  const bytes = await file.arrayBuffer();
  if (!matchesMagicBytes(ext, new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024)))) {
    const msg = "Nội dung tệp không đúng định dạng";
    throw AppError.validation(msg, { file: msg });
  }
  return { name: file.name.slice(-MAX_FILE_NAME), ext, bytes };
}

/** Parses multipart metadata (zod) and the optional/required `file` part. */
export async function parseDocumentForm(
  c: Context,
  opts: { fileRequired: boolean },
): Promise<{ input: DocumentInput; file: UploadedFile | null }> {
  const type = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "multipart/form-data") {
    throw AppError.validation("Yêu cầu phải là multipart/form-data");
  }
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw AppError.validation("Nội dung yêu cầu không hợp lệ");
  }
  const raw: Record<string, string> = {};
  for (const key of FIELDS) {
    const v = form.get(key);
    if (typeof v === "string") raw[key] = v;
  }
  const input = documentInputSchema.parse(raw);
  const part = form.get("file");
  // A browser sends an empty unnamed File when no file was chosen: treat as "no file".
  if (part instanceof File && !(part.size === 0 && part.name === ""))
    return { input, file: await readFile(part) };
  if (opts.fileRequired)
    throw AppError.validation("Chọn tệp văn bản", { file: "Chọn tệp văn bản" });
  return { input, file: null };
}
