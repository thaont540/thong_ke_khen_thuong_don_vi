import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Form, SubjectScope, UnitKind } from "../../../shared/domain-enums";

export const units = sqliteTable("units", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  kind: text("kind").$type<UnitKind>().notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ranks = sqliteTable("ranks", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  rankGroup: text("rank_group").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  level: text("level").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const authorities = sqliteTable("authorities", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const awardTypes = sqliteTable("award_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  form: text("form").$type<Form>().notNull(),
  subjectScope: text("subject_scope").$type<SubjectScope>().notNull(),
  defaultAuthorityId: integer("default_authority_id")
    .notNull()
    .references(() => authorities.id),
  requiresVariant: integer("requires_variant").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: integer("is_active").notNull(),
});

export const awardVariants = sqliteTable("award_variants", {
  id: integer("id").primaryKey(),
  awardTypeId: integer("award_type_id")
    .notNull()
    .references(() => awardTypes.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: integer("is_active").notNull(),
});
