import { z } from "zod";
import { ROLES } from "../domain-enums";
import { idSchema, pageSchema } from "./api-common-schemas";
import { PASSWORD_MIN_LENGTH } from "./auth-schemas";

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9._]{3,32}$/i, "Tên đăng nhập 3-32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới");

const fullNameSchema = z.string().trim().min(1).max(100);

/** POST /api/users */
export const userCreateSchema = z.object({
  username: usernameSchema,
  full_name: fullNameSchema,
  role: z.enum(ROLES),
  temp_password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

/** PUT /api/users/:id (username is immutable; lock/unlock via is_active) */
export const userUpdateSchema = z.object({
  full_name: fullNameSchema.optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
});

export const userDtoSchema = z.object({
  id: idSchema,
  username: z.string(),
  full_name: z.string(),
  role: z.enum(ROLES),
  is_active: z.boolean(),
  /** Temporarily locked after failed logins (locked_until in the future). */
  is_locked: z.boolean(),
  must_change_password: z.boolean(),
  last_login_at: z.string().nullable(),
});

export const userListResponseSchema = pageSchema(userDtoSchema);

/** POST /api/users/:id/reset-password response (shown once). */
export const resetPasswordResponseSchema = z.object({ temp_password: z.string() });

export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
