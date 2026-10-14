import type { Role } from "../../shared/domain-enums";
import type { UserDto } from "../../shared/schemas/user-schemas";
import { AppError } from "../lib/app-error";

export interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: number;
  must_change_password: number;
  locked_until: string | null;
  last_login_at: string | null;
}

export const USER_COLUMNS =
  "id, username, full_name, role, is_active, must_change_password, locked_until, last_login_at";

export const toDto = (r: UserRow, nowTs: string): UserDto => ({
  id: r.id,
  username: r.username,
  full_name: r.full_name,
  role: r.role,
  is_active: r.is_active === 1,
  is_locked: r.locked_until !== null && r.locked_until > nowTs,
  must_change_password: r.must_change_password === 1,
  last_login_at: r.last_login_at,
});

export async function findUser(d1: D1Database, id: number): Promise<UserRow> {
  const row = await d1
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
  if (!row) throw AppError.notFound("Không tìm thấy người dùng");
  return row;
}

/** SQL guard: another active ADMIN (not `?`) must remain after the change. */
export const OTHER_ACTIVE_ADMIN =
  "(SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id <> ?) >= 1";
