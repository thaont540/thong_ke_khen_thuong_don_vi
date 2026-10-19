import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  documentExtension,
  documentFileProblem,
  documentInputSchema,
} from "../../src/shared/schemas/document-schemas";

const file = (name: string, size = 10, type = "application/pdf") => ({ name, size, type });

describe("documentFileProblem", () => {
  it("accepts allowed extensions case-insensitively and the exact size cap", () => {
    expect(documentFileProblem(file("A.PDF"))).toBeNull();
    expect(documentFileProblem(file("b.xlsx", DOCUMENT_MAX_BYTES, ""))).toBeNull();
    expect(documentFileProblem(file("c.docx", 5, "application/octet-stream"))).toBeNull();
  });

  it.each([
    [file("a.pdf", DOCUMENT_MAX_BYTES + 1), "Tệp vượt quá 20 MB"],
    [file("a.pdf", 0), "Tệp rỗng"],
    [file("a.txt"), "Chỉ chấp nhận tệp PDF, DOC, DOCX, XLS, XLSX"],
    [file("pdf"), "Chỉ chấp nhận tệp PDF, DOC, DOCX, XLS, XLSX"],
    [file("a.pdf", 10, "text/html"), "Loại tệp không khớp với phần mở rộng"],
  ])("rejects %j", (f, message) => {
    expect(documentFileProblem(f)).toBe(message);
  });

  it("extension helper ignores unknown ones", () => {
    expect(documentExtension("x.tar.gz")).toBeNull();
    expect(documentExtension("x.Doc")).toBe("doc");
  });
});

describe("documentInputSchema", () => {
  const base = {
    doc_number: " 12/2026 ",
    title: "Tiêu  đề",
    doc_type: "KHAC",
    issuer: "BCA",
    issued_date: "2026-02-28",
  };
  it("normalizes text, defaults status and maps empty note to null", () => {
    expect(documentInputSchema.parse({ ...base, note: "  " })).toEqual({
      ...base,
      doc_number: "12/2026",
      title: "Tiêu đề",
      status: "CON_HIEU_LUC",
      note: null,
    });
  });
  it("rejects impossible dates", () => {
    expect(documentInputSchema.safeParse({ ...base, issued_date: "2026-02-30" }).success).toBe(
      false,
    );
  });
});
