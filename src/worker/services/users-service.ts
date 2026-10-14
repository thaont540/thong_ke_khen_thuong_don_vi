import { AUDIT_ACTION, ROLE, type Role } from "../../shared/domain-enums";
import { normalizeText } from "../../shared/normalize-text";
import type { UserCreate, UserDto, UserUpdate } from "../../shared/schemas/user-schemas";
import { AppError } from "../lib/app-error";
import { auditStatement } from "../lib/audit-log-statement";
import { hashPassword } from "../lib/password-hash";
import { sqlTimestamp } from "../lib/sql-timestamp";
import { generateTempPassword } from "../lib/temp-password";
import { deleteUserSessionsStatement } from "./session-service";

const LIST_CAP = 500; // users are a handful of rows; search/paging runs in JS (diacritic-insensitive)

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: number;
  must_change_password: number;
  locked_until: string | null;
  last_login_at: string | null;
}

const USER_COLUMNS =
  "id, username, full_name, role, is_active, must_change_password, locked_until, last_login_at";

const toDto = (r: UserRow, nowTs: string): UserDto => ({
  id: r.id,
  username: r.username,
  full_name: r.full_name,
  role: r.role,
  is_active: r.is_active === 1,
  is_locked: r.locked_until !== null && r.locked_until > nowTs,
  must_change_password: r.must_change_password === 1,
  last_login_at: r.last_login_at,
});

async function findUser(d1: D1Database, id: number): Promise<UserRow> {
  const row = await d1
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
  if (!row) throw AppError.notFound("Không tìm thấy người dùng");
  return row;
}

/** SQL guard: another active ADMIN (not `?`) must remain after the change. */
const OTHER_ACTIVE_ADMIN =
  "(SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id <> ?) >= 1";

export async function listUsers(
  d1: D1Database,
  q: { q?: string | undefined; page: number; size: number },
) {
  const { results } = await d1
    .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY username LIMIT ?`)
    .bind(LIST_CAP)
    .all<UserRow>();
  const term = normalizeText(q.q ?? "");
  const matched = term
    ? results.filter(
        (r) =>
          normalizeText(r.username).includes(term) || normalizeText(r.full_name).includes(term),
      )
    : results;
  const nowTs = sqlTimestamp();
  const start = (q.page - 1) * q.size;
  return {
    items: matched.slice(start, start + q.size).map((r) => toDto(r, nowTs)),
    total: matched.length,
    page: q.page,
    size: q.size,
  };
}

export async function createUser(d1: D1Database, actorId: number, input: UserCreate) {
  const hash = await hashPassword(input.temp_password);
  let results: D1Result[];
  try {
    results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO users (username, full_name, role, password_hash, must_change_password)
           VALUES (?, ?, ?, ?, 1)`,
        )
        .bind(input.username, input.full_name, input.role, hash),
      auditStatement(d1, {
        userId: actorId,
        action: AUDIT_ACTION.CREATE,
        entity: "user",
        entityId: "LAST_INSERT",
        detail: { username: input.username, role: input.role },
      }),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("users.username")) {
      throw AppError.conflict("Tên đăng nhập đã tồn tại", {
        username: "Tên đăng nhập đã tồn tại",
      });
    }
    throw err;
  }
  const id = results[0]?.meta.last_row_id;
  if (!id) throw new Error("user insert returned no row id");
  return toDto(await findUser(d1, id), sqlTimestamp());
}

export async function updateUser(d1: D1Database, actorId: number, id: number, patch: UserUpdate) {
  const before = await findUser(d1, id);
  const role = patch.role ?? before.role;
  const active = patch.is_active ?? before.is_active === 1;
  const deactivating = before.is_active === 1 && !active;
  const roleChanged = role !== before.role;

  if (id === actorId && (roleChanged || deactivating)) {
    throw AppError.conflict("Không thể tự đổi vai trò hoặc khóa tài khoản của chính mình");
  }
  const losesAdmin =
    before.role === ROLE.ADMIN && before.is_active === 1 && (role !== ROLE.ADMIN || !active);

  const reactivating = before.is_active !== 1 && active;
  const sets = ["full_name = ?", "role = ?", "is_active = ?", "updated_at = ?"];
  const binds: (string | number)[] = [
    patch.full_name ?? before.full_name,
    role,
    active ? 1 : 0,
    sqlTimestamp(),
  ];
  if (reactivating) sets.push("failed_login_count = 0", "locked_until = NULL");
  let where = "id = ?";
  binds.push(id);
  if (losesAdmin) {
    where += ` AND ${OTHER_ACTIVE_ADMIN}`;
    binds.push(id);
  }

  // Each statement after the UPDATE runs only if it changed a row (changes() chain), so a
  // lost race against the last-admin guard leaves no audit row and keeps the sessions.
  const statements = [
    d1.prepare(`UPDATE users SET ${sets.join(", ")} WHERE ${where}`).bind(...binds),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.UPDATE,
      entity: "user",
      entityId: id,
      detail: {
        before: {
          full_name: before.full_name,
          role: before.role,
          is_active: before.is_active === 1,
        },
        after: { full_name: patch.full_name ?? before.full_name, role, is_active: active },
      },
      onlyIfPreviousChanged: true,
    }),
  ];
  if ((before.is_active === 1) !== active) {
    statements.push(
      auditStatement(d1, {
        userId: actorId,
        action: active ? AUDIT_ACTION.UNLOCK : AUDIT_ACTION.LOCK,
        entity: "user",
        entityId: id,
        onlyIfPreviousChanged: true,
      }),
    );
  }
  if (roleChanged || deactivating) {
    statements.push(
      d1.prepare("DELETE FROM sessions WHERE user_id = ? AND changes() > 0").bind(id),
    );
  }
  const results = await d1.batch(statements);
  if ((results[0]?.meta.changes ?? 0) < 1) {
    throw AppError.conflict("Hệ thống phải còn ít nhất một quản trị viên đang hoạt động");
  }
  return toDto(await findUser(d1, id), sqlTimestamp());
}

/** Returns the new temp password (the only time it is ever visible). */
export async function resetPassword(
  d1: D1Database,
  actorId: number,
  id: number,
): Promise<{ temp_password: string }> {
  await findUser(d1, id);
  if (id === actorId) {
    throw AppError.conflict("Hãy dùng chức năng đổi mật khẩu cho tài khoản của chính mình");
  }
  const tempPassword = generateTempPassword();
  await d1.batch([
    d1
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_count = 0,
                locked_until = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(await hashPassword(tempPassword), sqlTimestamp(), id),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.PASSWORD_RESET,
      entity: "user",
      entityId: id,
    }),
    deleteUserSessionsStatement(d1, id),
  ]);
  return { temp_password: tempPassword };
}

export async function deleteUser(d1: D1Database, actorId: number, id: number): Promise<void> {
  const before = await findUser(d1, id);
  if (id === actorId) throw AppError.conflict("Không thể xóa tài khoản của chính mình");

  const results = await d1.batch([
    d1
      .prepare(
        `DELETE FROM users WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM officers WHERE created_by = ?)
           AND NOT EXISTS (SELECT 1 FROM awards WHERE created_by = ?)
           AND NOT EXISTS (SELECT 1 FROM import_batches WHERE created_by = ?)
           AND NOT EXISTS (SELECT 1 FROM audit_logs WHERE user_id = ?)
           AND (role <> 'ADMIN' OR is_active = 0 OR ${OTHER_ACTIVE_ADMIN})`,
      )
      .bind(id, id, id, id, id, id),
    auditStatement(d1, {
      userId: actorId,
      action: AUDIT_ACTION.DELETE,
      entity: "user",
      entityId: id,
      detail: { username: before.username, role: before.role },
      onlyIfPreviousChanged: true,
    }),
  ]);
  if ((results[0]?.meta.changes ?? 0) < 1) {
    throw AppError.conflict(
      "Không thể xóa tài khoản đã phát sinh dữ liệu hoặc nhật ký. Hãy khóa tài khoản thay vì xóa",
    );
  }
}
