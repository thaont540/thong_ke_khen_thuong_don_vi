import { z } from "zod";
import { ROLES } from "../domain-enums";

export const PASSWORD_MIN_LENGTH = 10;

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
});

export const changePasswordRequestSchema = z
  .object({
    current_password: z.string().min(1).max(200),
    new_password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirm_password: z.string().max(200),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Hai ô mật khẩu không khớp",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Mật khẩu mới phải khác mật khẩu cũ",
  });

/** GET /api/me and POST /api/auth/login response. */
export const meResponseSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  full_name: z.string(),
  role: z.enum(ROLES),
  must_change_password: z.boolean(),
});

export const okResponseSchema = z.object({ ok: z.literal(true) });

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
