import { ROLE, type Role } from "./domain-enums";

export type Screen =
  | "awards-list"
  | "award-create"
  | "award-import"
  | "officers"
  | "units"
  | "users"
  | "documents";

export type Action =
  | "award:write" // F03, F04, F09
  | "officer:manage" // F05
  | "unit:manage" // F06
  | "user:manage" // F08
  | "document:manage"; // văn bản quy định: thêm / sửa / xóa

const SCREENS: Record<Role, readonly Screen[]> = {
  ADMIN: ["awards-list", "award-create", "award-import", "officers", "units", "users", "documents"],
  EDITOR: ["awards-list", "award-create", "award-import", "documents"],
  VIEWER: ["awards-list", "documents"],
};

const ACTIONS: Record<Role, readonly Action[]> = {
  ADMIN: ["award:write", "officer:manage", "unit:manage", "user:manage", "document:manage"],
  EDITOR: ["award:write", "document:manage"],
  VIEWER: [],
};

export const canAccessScreen = (role: Role, screen: Screen): boolean =>
  SCREENS[role].includes(screen);

export const can = (role: Role, action: Action): boolean => ACTIONS[role].includes(action);

export const screensFor = (role: Role): readonly Screen[] => SCREENS[role];

/** Roles allowed to write awards; server middleware (phase 03+) uses the same lists. */
export const AWARD_WRITER_ROLES: readonly Role[] = [ROLE.ADMIN, ROLE.EDITOR];
export const ADMIN_ONLY: readonly Role[] = [ROLE.ADMIN];
