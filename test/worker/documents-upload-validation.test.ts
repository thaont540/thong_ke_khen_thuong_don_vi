import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { DOCUMENT_MAX_BYTES } from "../../src/shared/schemas/document-schemas";
import { app } from "../../src/worker/app";
import { api, createSession, errorOf, ORIGIN } from "./helpers/auth-helpers";
import {
  clearDocumentObjects,
  META,
  objectCount,
  PDF_BYTES,
  pdfFile,
  upload,
  ZIP_BYTES,
} from "./helpers/document-test-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

let token: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await clearDocumentObjects();
  await insertUser(env.DB, { id: 1, username: "admin1", role: "ADMIN" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  token = await createSession(env.DB, 1);
});

const post = (o: Parameters<typeof upload>[2] = {}) =>
  upload("POST", "/api/documents", { token, ...o });

async function expectRejected(res: Response, status: number, field?: string) {
  expect(res.status).toBe(status);
  if (field) expect((await errorOf(res)).fields?.[field]).toBeTruthy();
  expect(await objectCount()).toBe(0);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM regulation_documents").first<{
    n: number;
  }>();
  expect(n?.n).toBe(0);
}

describe("file validation", () => {
  it("accepts a file of exactly 20 MB and rejects one byte more with 413 before parsing", async () => {
    const ok = new Uint8Array(DOCUMENT_MAX_BYTES);
    ok.set(PDF_BYTES);
    expect(
      (await post({ file: { name: "lon.pdf", type: "application/pdf", bytes: ok } })).status,
    ).toBe(201);
    await clearDocumentObjects();
    await env.DB.prepare("DELETE FROM regulation_documents").run();
    const big = new Uint8Array(DOCUMENT_MAX_BYTES + 128 * 1024);
    big.set(PDF_BYTES);
    await expectRejected(
      await post({ file: { name: "qua-lon.pdf", type: "application/pdf", bytes: big } }),
      413,
    );
  });

  it("rejects a file just over 20 MB that fits the multipart envelope with 400 on the file field", async () => {
    const big = new Uint8Array(DOCUMENT_MAX_BYTES + 1);
    big.set(PDF_BYTES);
    await expectRejected(
      await post({ file: { name: "a.pdf", type: "application/pdf", bytes: big } }),
      400,
      "file",
    );
  });

  it.each([
    ["virus.exe", "application/octet-stream"],
    ["page.html", "text/html"],
    ["noext", "application/pdf"],
    ["a.pdf.exe", "application/pdf"],
  ])("rejects extension %s", async (name, type) => {
    await expectRejected(await post({ file: { name, type, bytes: PDF_BYTES } }), 400, "file");
  });

  it("rejects a content-type that contradicts the extension", async () => {
    await expectRejected(
      await post({ file: { name: "a.pdf", type: "text/html", bytes: PDF_BYTES } }),
      400,
      "file",
    );
  });

  it("rejects content whose magic bytes do not match the extension", async () => {
    await expectRejected(
      await post({ file: { name: "a.pdf", type: "application/pdf", bytes: ZIP_BYTES } }),
      400,
      "file",
    );
    await expectRejected(
      await post({ file: { name: "a.docx", type: "", bytes: PDF_BYTES } }),
      400,
      "file",
    );
    await expectRejected(
      await post({ file: { name: "a.xls", type: "application/vnd.ms-excel", bytes: ZIP_BYTES } }),
      400,
      "file",
    );
  });

  it("accepts docx/xlsx ZIP content and a generic content-type", async () => {
    expect(
      (await post({ file: { name: "a.docx", type: "application/octet-stream", bytes: ZIP_BYTES } }))
        .status,
    ).toBe(201);
    expect((await post({ file: { name: "b.xlsx", type: "", bytes: ZIP_BYTES } })).status).toBe(201);
  });

  it("requires a file on create and rejects an empty one", async () => {
    await expectRejected(await post({ file: null }), 400, "file");
    await expectRejected(
      await post({ file: { name: "a.pdf", type: "application/pdf", bytes: new Uint8Array(0) } }),
      400,
      "file",
    );
  });
});

describe("metadata validation", () => {
  it.each([
    ["doc_number", ""],
    ["doc_number", "x".repeat(101)],
    ["title", "  "],
    ["title", "x".repeat(1001)],
    ["doc_type", "KHONG_CO"],
    ["issuer", ""],
    ["issued_date", "2026-02-30"],
    ["issued_date", "15/03/2026"],
    ["status", "NOPE"],
    ["note", "x".repeat(1001)],
  ])("rejects %s = %j", async (key, value) => {
    await expectRejected(await post({ meta: { ...META, [key]: value } }), 400, key);
  });

  it("rejects a JSON body on the upload route", async () => {
    const res = await api("/api/documents", { token, body: META });
    expect(res.status).toBe(400);
  });
});

describe("transactional behaviour", () => {
  it("removes the R2 object when the D1 insert fails", async () => {
    await env.DB.prepare("DROP INDEX ix_regulation_documents_list").run();
    await env.DB.prepare(
      "ALTER TABLE regulation_documents RENAME TO regulation_documents_bak",
    ).run();
    try {
      const res = await post();
      expect(res.status).toBe(500);
      expect(await objectCount()).toBe(0);
    } finally {
      await env.DB.prepare(
        "ALTER TABLE regulation_documents_bak RENAME TO regulation_documents",
      ).run();
      await env.DB.prepare(
        "CREATE INDEX ix_regulation_documents_list ON regulation_documents(issued_date DESC, id DESC) WHERE deleted_at IS NULL",
      ).run();
    }
  });
});

describe("origin check and body limits", () => {
  it("still requires a same-origin Origin on uploads", async () => {
    await expectRejected(await post({ headers: { Origin: "https://evil.example" } }), 403);
    await expectRejected(await post({ headers: { Origin: "" } }), 403);
  });

  it("allows multipart only on the document routes", async () => {
    const form = new FormData();
    form.set("username", "admin1");
    const res = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { Origin: ORIGIN }, body: form },
      env,
    );
    expect(res.status).toBe(403);
    const units = await app.request(
      "/api/units",
      { method: "POST", headers: { Origin: ORIGIN, Cookie: `__Host-sid=${token}` }, body: form },
      env,
    );
    expect(units.status).toBe(403);
    const del = await app.request(
      "/api/documents/1",
      { method: "DELETE", headers: { Origin: ORIGIN, Cookie: `__Host-sid=${token}` }, body: form },
      env,
    );
    expect(del.status).toBe(403);
  });

  it("keeps the 256 KB cap on other routes while documents accept more", async () => {
    const big = JSON.stringify({ code: "x".repeat(300 * 1024) });
    const res = await api("/api/units", { token, method: "POST", body: JSON.parse(big) });
    expect(res.status).toBe(413);
    const pdf = new Uint8Array(512 * 1024);
    pdf.set(PDF_BYTES);
    expect((await post({ file: { ...pdfFile(), bytes: pdf } })).status).toBe(201);
  });
});
