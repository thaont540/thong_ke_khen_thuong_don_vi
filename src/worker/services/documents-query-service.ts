import type { DocumentItem, DocumentListQuery } from "../../shared/schemas/document-schemas";
import { AppError } from "../lib/app-error";
import { LIKE_ESCAPE, toLikePattern } from "../lib/sql-like-pattern";

const COLUMNS = `id, doc_number, title, doc_type, issuer, issued_date, status, note,
  file_name, content_type, size_bytes, created_at, updated_at`;

export interface DocumentFileRow {
  file_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export async function listDocuments(d1: D1Database, q: DocumentListQuery) {
  const where = ["deleted_at IS NULL"];
  const binds: (string | number)[] = [];
  const pattern = toLikePattern(q.q);
  if (pattern) {
    where.push(
      `(title_search LIKE ? ESCAPE '${LIKE_ESCAPE}' OR doc_number_search LIKE ? ESCAPE '${LIKE_ESCAPE}')`,
    );
    binds.push(pattern, pattern);
  }
  if (q.doc_type) {
    where.push("doc_type = ?");
    binds.push(q.doc_type);
  }
  if (q.status) {
    where.push("status = ?");
    binds.push(q.status);
  }
  const clause = where.join(" AND ");
  const [count, rows] = await d1.batch([
    d1.prepare(`SELECT COUNT(*) AS n FROM regulation_documents WHERE ${clause}`).bind(...binds),
    d1
      .prepare(
        `SELECT ${COLUMNS} FROM regulation_documents WHERE ${clause}
         ORDER BY issued_date DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, q.size, (q.page - 1) * q.size),
  ]);
  return {
    items: (rows?.results ?? []) as unknown as DocumentItem[],
    total: ((count?.results[0] as { n: number } | undefined)?.n ?? 0) as number,
    page: q.page,
    size: q.size,
  };
}

export async function getDocument(d1: D1Database, id: number): Promise<DocumentItem> {
  const row = await d1
    .prepare(`SELECT ${COLUMNS} FROM regulation_documents WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<DocumentItem>();
  if (!row) throw AppError.notFound("Không tìm thấy văn bản");
  return row;
}

export async function getDocumentFile(d1: D1Database, id: number): Promise<DocumentFileRow> {
  const row = await d1
    .prepare(
      `SELECT file_key, file_name, content_type, size_bytes FROM regulation_documents
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<DocumentFileRow>();
  if (!row) throw AppError.notFound("Không tìm thấy văn bản");
  return row;
}
