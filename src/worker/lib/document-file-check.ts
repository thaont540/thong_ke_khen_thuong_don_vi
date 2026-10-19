import { type DocumentExt } from "../../shared/schemas/document-schemas";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx / xlsx are ZIP containers
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy doc / xls

const MAGIC: Record<DocumentExt, readonly number[]> = {
  pdf: PDF,
  doc: OLE,
  xls: OLE,
  docx: ZIP,
  xlsx: ZIP,
};

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  sig.every((v, i) => b[at + i] === v);

/** Cheap content sniff so a renamed executable/HTML cannot be stored as a document. */
export function matchesMagicBytes(ext: DocumentExt, bytes: Uint8Array): boolean {
  const sig = MAGIC[ext];
  if (ext !== "pdf") return startsWith(bytes, sig);
  // Readers tolerate junk before %PDF- within the first KB.
  const limit = Math.min(bytes.length, 1024) - sig.length;
  for (let i = 0; i <= limit; i++) if (startsWith(bytes, sig, i)) return true;
  return false;
}
