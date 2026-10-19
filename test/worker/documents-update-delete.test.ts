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

describe("update and delete", () => {
  it("updates metadata only, keeping the file", async () => {
    const doc = await create();
    const res = await upload("PUT", `/api/documents/${doc.id}`, {
      token: editor,
      file: null,
      meta: { ...META, title: "Tiêu đề mới", status: "HET_HIEU_LUC" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      title: "Tiêu đề mới",
      status: "HET_HIEU_LUC",
      file_name: doc.file_name,
    });
    expect(await objectCount()).toBe(1);
    expect(
      (
        (await api("/api/documents?q=tiêu đề mới", { token: viewer }).then((r) => r.json())) as {
          total: number;
        }
      ).total,
    ).toBe(1);
  });

  it("replaces the file: new object stored, old object deleted, metadata refreshed", async () => {
    const doc = await create();
    const before = await env.DB.prepare("SELECT file_key FROM regulation_documents WHERE id = ?")
      .bind(doc.id)
      .first<{ file_key: string }>();
    const res = await upload("PUT", `/api/documents/${doc.id}`, {
      token: admin,
      file: { name: "cu.doc", type: "application/msword", bytes: OLE_BYTES },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      file_name: "cu.doc",
      content_type: "application/msword",
      size_bytes: OLE_BYTES.byteLength,
    });
    expect(await objectCount()).toBe(1);
    expect(await env.DOCS.head(before?.file_key ?? "")).toBeNull();
  });

  it("a failed replacement leaves the old file; unknown id is 404 without orphan objects", async () => {
    const doc = await create();
    const bad = await upload("PUT", `/api/documents/${doc.id}`, {
      token: admin,
      file: { name: "x.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3]) },
    });
    expect(bad.status).toBe(400);
    expect((await upload("PUT", "/api/documents/999", { token: admin })).status).toBe(404);
    expect(await objectCount()).toBe(1);
    expect((await api(`/api/documents/${doc.id}/download`, { token: admin })).status).toBe(200);
  });

  it("delete soft-deletes the row, removes the object, audits, then 404s", async () => {
    const doc = await create();
    const res = await api(`/api/documents/${doc.id}`, { method: "DELETE", token: editor });
    expect(res.status).toBe(200);
    expect(await objectCount()).toBe(0);
    const row = await env.DB.prepare("SELECT deleted_at FROM regulation_documents WHERE id = ?")
      .bind(doc.id)
      .first<{ deleted_at: string | null }>();
    expect(row?.deleted_at).not.toBeNull();
    expect((await api(`/api/documents/${doc.id}`, { token: admin })).status).toBe(404);
    expect((await api(`/api/documents/${doc.id}/download`, { token: admin })).status).toBe(404);
    expect((await api(`/api/documents/${doc.id}`, { method: "DELETE", token: admin })).status).toBe(
      404,
    );
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) n FROM audit_logs WHERE entity='document' AND action='DELETE'",
    ).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });
});
