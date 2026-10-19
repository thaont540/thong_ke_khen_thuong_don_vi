import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentItem } from "../../src/shared/schemas/document-schemas";
import { api, createSession, errorOf } from "./helpers/auth-helpers";
import {
  clearDocumentObjects,
  META,
  OLE_BYTES,
  objectCount,
  PDF_BYTES,
  pdfFile,
  upload,
} from "./helpers/document-test-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

let admin: string;
let editor: string;
let viewer: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await clearDocumentObjects();
  await insertUser(env.DB, { id: 1, username: "admin1", role: "ADMIN" });
  await insertUser(env.DB, { id: 2, username: "editor1", role: "EDITOR" });
  await insertUser(env.DB, { id: 3, username: "viewer1", role: "VIEWER" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  admin = await createSession(env.DB, 1);
  editor = await createSession(env.DB, 2);
  viewer = await createSession(env.DB, 3);
});

const create = async (meta: Record<string, string> = {}, token = admin) => {
  const res = await upload("POST", "/api/documents", { token, meta: { ...META, ...meta } });
  expect(res.status).toBe(201);
  return (await res.json()) as DocumentItem;
};

describe("create + read", () => {
  it("stores the object in R2 and metadata in D1 (no file_key leaked), audits it", async () => {
    const doc = await create({ note: "  ghi chú  " });
    expect(doc).toMatchObject({
      doc_number: META.doc_number,
      doc_type: "NGHI_DINH",
      issued_date: "2026-03-15",
      status: "CON_HIEU_LUC",
      note: "ghi chú",
      file_name: "nghi-dinh-12.pdf",
      content_type: "application/pdf",
      size_bytes: PDF_BYTES.byteLength,
    });
    expect(doc).not.toHaveProperty("file_key");
    expect(await objectCount()).toBe(1);
    const audit = await env.DB.prepare(
      "SELECT user_id, action, entity, entity_id FROM audit_logs WHERE entity = 'document'",
    ).first();
    expect(audit).toEqual({ user_id: 1, action: "CREATE", entity: "document", entity_id: doc.id });
  });

  it("EDITOR can create; every role can get one document", async () => {
    const doc = await create({}, editor);
    for (const token of [admin, editor, viewer]) {
      const res = await api(`/api/documents/${doc.id}`, { token });
      expect(res.status).toBe(200);
    }
    expect((await api("/api/documents/999", { token: viewer })).status).toBe(404);
  });

  it("VIEWER cannot create, update or delete (and nothing is written)", async () => {
    const doc = await create();
    expect((await upload("POST", "/api/documents", { token: viewer })).status).toBe(403);
    expect((await upload("PUT", `/api/documents/${doc.id}`, { token: viewer })).status).toBe(403);
    expect(
      (await api(`/api/documents/${doc.id}`, { method: "DELETE", token: viewer })).status,
    ).toBe(403);
    expect(await objectCount()).toBe(1);
  });
});

describe("list, search and filters", () => {
  beforeEach(async () => {
    await create({
      doc_number: "01/2025/TT-BCA",
      title: "Hướng dẫn xét tặng",
      doc_type: "THONG_TU",
      issued_date: "2025-01-10",
    });
    await create({
      doc_number: "02/2026/QĐ-BCA",
      title: "Quyết định thành lập hội đồng",
      doc_type: "QUYET_DINH",
      status: "HET_HIEU_LUC",
      issued_date: "2026-05-01",
    });
    await create({
      doc_number: "03/2026/NĐ-CP",
      title: "Nghị định mới",
      issued_date: "2026-05-01",
    });
  });
  const list = async (qs = "") =>
    (await (await api(`/api/documents${qs}`, { token: viewer })).json()) as {
      items: DocumentItem[];
      total: number;
    };

  it("sorts by issued_date DESC then id DESC", async () => {
    const r = await list();
    expect(r.items.map((d) => d.doc_number)).toEqual([
      "03/2026/NĐ-CP",
      "02/2026/QĐ-BCA",
      "01/2025/TT-BCA",
    ]);
    expect(r.total).toBe(3);
  });

  it("searches title and number ignoring case and diacritics-insensitive normalization", async () => {
    expect((await list("?q=HỘI ĐỒNG")).items).toHaveLength(1);
    expect((await list("?q=02/2026")).items[0]?.doc_number).toBe("02/2026/QĐ-BCA");
    expect((await list("?q=100%25")).total).toBe(0);
  });

  it("filters by type and status, and paginates", async () => {
    expect((await list("?doc_type=THONG_TU")).total).toBe(1);
    expect((await list("?status=HET_HIEU_LUC")).items[0]?.doc_number).toBe("02/2026/QĐ-BCA");
    const p2 = await list("?size=2&page=2");
    expect(p2.items).toHaveLength(1);
    expect(p2.total).toBe(3);
    expect((await api("/api/documents?size=51", { token: viewer })).status).toBe(400);
    expect((await api("/api/documents?doc_type=X", { token: viewer })).status).toBe(400);
  });
});

describe("download", () => {
  it("round-trips the bytes with safe headers and a UTF-8 file name", async () => {
    const name = "Nghị định số 12 (2026).pdf";
    const res0 = await upload("POST", "/api/documents", { token: admin, file: pdfFile(name) });
    const doc = (await res0.json()) as DocumentItem;
    const res = await api(`/api/documents/${doc.id}/download`, { token: viewer });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      `filename*=UTF-8''${encodeURIComponent("Nghị định số 12 ").replace(/\(/g, "%28")}`,
    );
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; /);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("404 when the document or its object is missing", async () => {
    expect((await api("/api/documents/42/download", { token: admin })).status).toBe(404);
    const doc = await create();
    await clearDocumentObjects();
    const res = await api(`/api/documents/${doc.id}/download`, { token: admin });
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("NOT_FOUND");
  });
});
