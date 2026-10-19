import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentItem } from "../../src/shared/schemas/document-schemas";
import { updateDocument } from "../../src/worker/services/documents-service";
import { api, createSession } from "./helpers/auth-helpers";
import {
  clearDocumentObjects,
  META,
  objectCount,
  PDF_BYTES,
  pdfFile,
  upload,
} from "./helpers/document-test-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

let admin: string;

beforeEach(async () => {
  await resetTestData(env.DB);
  await clearDocumentObjects();
  await insertUser(env.DB, { id: 1, username: "admin1", role: "ADMIN" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  admin = await createSession(env.DB, 1);
});

const EMOJI = "\u{1F600}";

describe("file names with astral characters at the truncation boundary", () => {
  // x + emoji + 55 a + ".pdf" = 62 UTF-16 units: slice(-60) would start on a low surrogate.
  const metaBoundary = `x${EMOJI}${"a".repeat(55)}.pdf`;
  // 257 units: slice(-255) would start on a low surrogate.
  const dbBoundary = `x${EMOJI}${"a".repeat(250)}.pdf`;

  for (const [label, name] of [
    ["KV metadata (60)", metaBoundary],
    ["stored name (255)", dbBoundary],
  ] as const) {
    it(`uploads and downloads when the cut falls inside an emoji: ${label}`, async () => {
      const res = await upload("POST", "/api/documents", { token: admin, file: pdfFile(name) });
      expect(res.status).toBe(201);
      const doc = (await res.json()) as DocumentItem;
      expect(() => encodeURIComponent(doc.file_name)).not.toThrow();
      const dl = await api(`/api/documents/${doc.id}/download`, { token: admin });
      expect(dl.status).toBe(200);
      expect(dl.headers.get("content-disposition")).toContain("filename*=UTF-8''");
      expect(await dl.arrayBuffer()).toEqual(PDF_BYTES.buffer.slice(0));
    });
  }

  it("a replacement upload with such a name works too", async () => {
    const created = await upload("POST", "/api/documents", { token: admin });
    const doc = (await created.json()) as DocumentItem;
    const res = await upload("PUT", `/api/documents/${doc.id}`, {
      token: admin,
      file: pdfFile(metaBoundary),
    });
    expect(res.status).toBe(200);
    expect((await api(`/api/documents/${doc.id}/download`, { token: admin })).status).toBe(200);
  });
});

describe("concurrent file replacement", () => {
  it("409 and no orphan object when the file was replaced by someone else meanwhile", async () => {
    const created = await upload("POST", "/api/documents", { token: admin });
    const doc = (await created.json()) as DocumentItem;
    const original = await env.DB.prepare("SELECT file_key FROM regulation_documents WHERE id = ?")
      .bind(doc.id)
      .first<{ file_key: string }>();
    // The other writer commits between our read of file_key and our batch.
    const racing = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "batch") {
          return async (stmts: D1PreparedStatement[]) => {
            await target
              .prepare("UPDATE regulation_documents SET file_key = ? WHERE id = ?")
              .bind("documents/other-writer", doc.id)
              .run();
            return target.batch(stmts);
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const form = { doc_number: "1", title: "t", doc_type: "NGHI_DINH", issuer: "i" } as const;
    const err = await updateDocument(
      { DB: racing, DOCS: env.DOCS },
      1,
      doc.id,
      { ...META, ...form, issued_date: "2026-03-15", status: "CON_HIEU_LUC", note: "" } as never,
      { name: "moi.pdf", ext: "pdf", bytes: PDF_BYTES.buffer.slice(0) as ArrayBuffer },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 409,
      message: "Văn bản vừa được người khác cập nhật, vui lòng tải lại",
    });
    // Only the original object remains: the newly uploaded one was removed.
    expect(await objectCount()).toBe(1);
    expect(await env.DOCS.get(original?.file_key ?? "")).not.toBeNull();
    const row = await env.DB.prepare(
      "SELECT title, file_name FROM regulation_documents WHERE id = ?",
    )
      .bind(doc.id)
      .first<{ title: string; file_name: string }>();
    expect(row?.file_name).toBe(doc.file_name);
    expect(row?.title).toBe(doc.title);
  });
});
