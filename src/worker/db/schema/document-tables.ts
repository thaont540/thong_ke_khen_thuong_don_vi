import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { DocStatus, DocType } from "../../../shared/schemas/document-schemas";
import { users } from "./user-session-tables";

export const regulationDocuments = sqliteTable("regulation_documents", {
  id: integer("id").primaryKey(),
  docNumber: text("doc_number").notNull(),
  docNumberSearch: text("doc_number_search").notNull(),
  title: text("title").notNull(),
  titleSearch: text("title_search").notNull(),
  docType: text("doc_type").$type<DocType>().notNull(),
  issuer: text("issuer").notNull(),
  issuedDate: text("issued_date").notNull(),
  status: text("status").$type<DocStatus>().notNull(),
  note: text("note"),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});
