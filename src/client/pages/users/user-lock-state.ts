import type { UserDto } from "../../../shared/schemas/user-schemas";

/** Deactivated, or temporarily locked after failed logins: the admin action is "Mở khóa". */
export const isLockedOut = (u: Pick<UserDto, "is_active" | "is_locked">): boolean =>
  !u.is_active || u.is_locked;
