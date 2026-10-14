import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AuditAction, Subject } from "../../../shared/domain-enums";
import {
  authorities,
  awardTypes,
  awardVariants,
  positions,
  ranks,
  teams,
  units,
} from "./master-data-tables";
import { users } from "./user-session-tables";

export const officers = sqliteTable("officers", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  fullName: text("full_name").notNull(),
  fullNameSearch: text("full_name_search").notNull(),
  birthYear: integer("birth_year").notNull(),
  badgeNumber: text("badge_number").notNull(),
  rankId: integer("rank_id")
    .notNull()
    .references(() => ranks.id),
  positionId: integer("position_id")
    .notNull()
    .references(() => positions.id),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id),
  teamId: integer("team_id").references(() => teams.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull(),
  importedRows: integer("imported_rows").notNull(),
  errorRows: integer("error_rows").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const awards = sqliteTable("awards", {
  id: integer("id").primaryKey(),
  subject: text("subject").$type<Subject>().notNull(),
  officerId: integer("officer_id").references(() => officers.id),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id),
  teamId: integer("team_id").references(() => teams.id),
  awardTypeId: integer("award_type_id")
    .notNull()
    .references(() => awardTypes.id),
  awardVariantId: integer("award_variant_id").references(() => awardVariants.id),
  year: integer("year").notNull(),
  decisionNumber: text("decision_number").notNull(),
  decisionNumberSearch: text("decision_number_search").notNull(),
  decisionDate: text("decision_date").notNull(),
  authorityId: integer("authority_id")
    .notNull()
    .references(() => authorities.id),
  achievement: text("achievement").notNull(),
  note: text("note"),
  importBatchId: integer("import_batch_id").references(() => importBatches.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").$type<AuditAction>().notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});
