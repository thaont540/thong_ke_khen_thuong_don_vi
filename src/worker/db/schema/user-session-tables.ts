import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Role } from "../../../shared/domain-enums";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").$type<Role>().notNull(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: integer("must_change_password").notNull(),
  failedLoginCount: integer("failed_login_count").notNull(),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  isActive: integer("is_active").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
});
