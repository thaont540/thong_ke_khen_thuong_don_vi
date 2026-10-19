import { AUDIT_ACTION } from "../../shared/domain-enums";
import { normalizeText } from "../../shared/normalize-text";
import {
  DOCUMENT_FILE_TYPES,
  type DocumentInput,
  type DocumentItem,
} from "../../shared/schemas/document-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { documentFileStore } from "../lib/document-file-store";
import type { UploadedFile } from "../lib/parse-document-form";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { getDocument } from "./documents-query-service";

const STALE_FILE_MESSAGE = "Văn bản vừa được người khác cập nhật, vui lòng tải lại";

const newKey = () => `documents/${crypto.randomUUID()}`;

async function putObject(env: Pick<Env, "DOCS">, file: UploadedFile): Promise<string> {
  const key = newKey();
  await documentFileStore.put(env, key, file.bytes, {
    contentType: DOCUMENT_FILE_TYPES[file.ext].mime,
    fileName: file.name,
    size: file.bytes.byteLength,
  });
  return key;
}

export async function createDocument(
  env: Pick<Env, "DB" | "DOCS">,
  actorId: number,
  input: DocumentInput,
  file: UploadedFile,
): Promise<DocumentItem> {
  const key = await putObject(env, file); // KV first: a row never points at a missing object
  const mime = DOCUMENT_FILE_TYPES[file.ext].mime;
  let id: number | undefined;
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO regulation_documents
             (doc_number, doc_number_search, title, title_search, doc_type, issuer, issued_date,
              status, note, file_key, file_name, content_type, size_bytes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        input.doc_number,
        normalizeText(input.doc_number),
        input.title,
        normalizeText(input.title),
        input.doc_type,
        input.issuer,
        input.issued_date,
        input.status,
        input.note,
        key,
        file.name,
        mime,
        file.bytes.byteLength,
        actorId,
      ),
      auditStatement(env.DB, {
        userId: actorId,
        action: AUDIT_ACTION.CREATE,
        entity: "document",
        entityId: "LAST_INSERT",
        detail: { doc_number: input.doc_number, title: input.title, file_name: file.name },
      }),
    ]);
    id = results[0]?.meta.last_row_id;
    if (!id) throw new Error("document insert returned no row id");
  } catch (err) {
    await documentFileStore.delete(env, key);
    throw err;
  }
  return getDocument(env.DB, id);
}

export async function updateDocument(
  env: Pick<Env, "DB" | "DOCS">,
  actorId: number,
  id: number,
  input: DocumentInput,
  file: UploadedFile | null,
): Promise<DocumentItem> {
  const before = await getDocument(env.DB, id);
  const old = await env.DB.prepare("SELECT file_key FROM regulation_documents WHERE id = ?")
    .bind(id)
    .first<{ file_key: string }>();
  if (!old) throw AppError.notFound("Không tìm thấy văn bản");
  const newFileKey = file ? await putObject(env, file) : null;
  const fields = [
    "doc_number",
    "title",
    "doc_type",
    "issuer",
    "issued_date",
    "status",
    "note",
  ] as const;
  const changed = fields.filter((f) => before[f] !== input[f]);
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE regulation_documents SET doc_number = ?, doc_number_search = ?, title = ?,
             title_search = ?, doc_type = ?, issuer = ?, issued_date = ?, status = ?, note = ?,
             file_key = COALESCE(?, file_key), file_name = COALESCE(?, file_name),
             content_type = COALESCE(?, content_type), size_bytes = COALESCE(?, size_bytes),
             updated_at = ?
           WHERE id = ? AND deleted_at IS NULL AND (? IS NULL OR file_key = ?)`,
      ).bind(
        input.doc_number,
        normalizeText(input.doc_number),
        input.title,
        normalizeText(input.title),
        input.doc_type,
        input.issuer,
        input.issued_date,
        input.status,
        input.note,
        newFileKey,
        file?.name ?? null,
        file ? DOCUMENT_FILE_TYPES[file.ext].mime : null,
        file?.bytes.byteLength ?? null,
        sqlTimestamp(),
        id,
        // File replacement only commits if nobody replaced the file since we read it.
        newFileKey ? old.file_key : null,
        old.file_key,
      ),
      auditStatement(env.DB, {
        userId: actorId,
        action: AUDIT_ACTION.UPDATE,
        entity: "document",
        entityId: id,
        onlyIfPreviousChanged: true,
        detail: {
          before: Object.fromEntries(changed.map((f) => [f, before[f]])),
          after: Object.fromEntries(changed.map((f) => [f, input[f]])),
          ...(file ? { file_replaced: { from: before.file_name, to: file.name } } : {}),
        },
      }),
    ]);
    if (results[0]?.meta.changes === 0) {
      const alive = await env.DB.prepare(
        "SELECT 1 AS ok FROM regulation_documents WHERE id = ? AND deleted_at IS NULL",
      )
        .bind(id)
        .first();
      throw alive
        ? AppError.conflict(STALE_FILE_MESSAGE)
        : AppError.notFound("Không tìm thấy văn bản");
    }
  } catch (err) {
    if (newFileKey) await documentFileStore.delete(env, newFileKey);
    throw err;
  }
  if (newFileKey) await documentFileStore.delete(env, old.file_key);
  return getDocument(env.DB, id);
}

/** Soft-deletes the row (audit trail keeps the metadata) and frees the stored file. */
export async function deleteDocument(
  env: Pick<Env, "DB" | "DOCS">,
  actorId: number,
  id: number,
): Promise<void> {
  const before = await getDocument(env.DB, id);
  const row = await env.DB.prepare("SELECT file_key FROM regulation_documents WHERE id = ?")
    .bind(id)
    .first<{ file_key: string }>();
  const ts = sqlTimestamp();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE regulation_documents SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    ).bind(ts, ts, id),
    auditStatement(env.DB, {
      userId: actorId,
      action: AUDIT_ACTION.DELETE,
      entity: "document",
      entityId: id,
      onlyIfPreviousChanged: true,
      detail: { doc_number: before.doc_number, title: before.title, file_name: before.file_name },
    }),
  ]);
  if (row) await documentFileStore.delete(env, row.file_key);
}
