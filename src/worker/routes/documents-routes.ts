import { Hono } from "hono";
import { AWARD_WRITER_ROLES } from "../../shared/role-permissions";
import { documentListQuerySchema } from "../../shared/schemas/document-schemas";
import { AppError } from "../lib/app-error";
import { documentFileStore } from "../lib/document-file-store";
import { parseDocumentForm } from "../lib/parse-document-form";
import { parseIdParam } from "../lib/parse-request";
import { requireRole } from "../middleware/require-role-middleware";
import { getDocument, getDocumentFile, listDocuments } from "../services/documents-query-service";
import { createDocument, deleteDocument, updateDocument } from "../services/documents-service";
import type { AppEnv } from "../types/hono-env";

export const documentsRoutes = new Hono<AppEnv>();

const FILE_NOT_READY = "Tệp chưa sẵn sàng hoặc không tồn tại, vui lòng thử lại sau ít phút";

const writers = requireRole(...AWARD_WRITER_ROLES);

/** RFC 5987 value: encodeURIComponent plus the characters it leaves bare. */
const encodeRfc5987 = (s: string) =>
  encodeURIComponent(s).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

documentsRoutes.get("/", async (c) =>
  c.json(await listDocuments(c.env.DB, documentListQuerySchema.parse(c.req.query()))),
);

documentsRoutes.get("/:id/download", async (c) => {
  const file = await getDocumentFile(c.env.DB, parseIdParam(c.req.param("id")));
  const object = await documentFileStore.get(c.env, file.file_key);
  // KV is eventually consistent: a just-uploaded value may not be readable here yet.
  if (!object) throw AppError.notFound(FILE_NOT_READY);
  const ascii = file.file_name.replace(/[^\x20-\x7e]|["\;]/g, "_");
  return new Response(object.body, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Length": String(object.metadata.size),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(file.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

documentsRoutes.get("/:id", async (c) =>
  c.json(await getDocument(c.env.DB, parseIdParam(c.req.param("id")))),
);

documentsRoutes.post("/", writers, async (c) => {
  const { input, file } = await parseDocumentForm(c, { fileRequired: true });
  if (!file) throw AppError.validation("Chọn tệp văn bản");
  return c.json(await createDocument(c.env, c.var.user.id, input, file), 201);
});

documentsRoutes.put("/:id", writers, async (c) => {
  const id = parseIdParam(c.req.param("id"));
  const { input, file } = await parseDocumentForm(c, { fileRequired: false });
  return c.json(await updateDocument(c.env, c.var.user.id, id, input, file));
});

documentsRoutes.delete("/:id", writers, async (c) => {
  await deleteDocument(c.env, c.var.user.id, parseIdParam(c.req.param("id")));
  return c.json({ ok: true });
});
