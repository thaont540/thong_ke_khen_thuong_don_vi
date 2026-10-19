import { env } from "cloudflare:workers";
import { app } from "../../../src/worker/app";
import { ORIGIN } from "./auth-helpers";

export const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\nhello é world\n%%EOF");
export const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
export const OLE_BYTES = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 9]);

export const META = {
  doc_number: "12/2026/NĐ-CP",
  title: "Quy định về thi đua, khen thưởng trong Công an nhân dân",
  doc_type: "NGHI_DINH",
  issuer: "Chính phủ",
  issued_date: "2026-03-15",
  status: "CON_HIEU_LUC",
  note: "",
};

export interface UploadOptions {
  token?: string;
  meta?: Record<string, string>;
  /** `null` = no file part. */
  file?: { name: string; type: string; bytes: Uint8Array | ArrayBuffer } | null;
  headers?: Record<string, string>;
}

export const pdfFile = (name = "nghi-dinh-12.pdf") => ({
  name,
  type: "application/pdf",
  bytes: PDF_BYTES,
});

/** Same-origin multipart request like the browser (Content-Type + boundary come from FormData). */
export function upload(method: "POST" | "PUT", path: string, o: UploadOptions = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(o.meta ?? META)) form.set(k, v);
  const file = o.file === undefined ? pdfFile() : o.file;
  if (file) form.set("file", new File([file.bytes as ArrayBuffer], file.name, { type: file.type }));
  const headers: Record<string, string> = { Origin: ORIGIN, ...o.headers };
  if (o.token) headers.Cookie = `__Host-sid=${o.token}`;
  return Promise.resolve(app.request(path, { method, headers, body: form }, env));
}

export async function clearDocumentObjects() {
  const listed = await env.DOCS.list();
  await Promise.all(listed.objects.map((o) => env.DOCS.delete(o.key)));
}

export const objectCount = async () => (await env.DOCS.list()).objects.length;
