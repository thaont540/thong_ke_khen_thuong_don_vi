export const ROLE = { ADMIN: "ADMIN", EDITOR: "EDITOR", VIEWER: "VIEWER" } as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
export const ROLES = Object.values(ROLE) as [Role, ...Role[]];

export const SUBJECT = { TAP_THE: "TAP_THE", CA_NHAN: "CA_NHAN" } as const;
export type Subject = (typeof SUBJECT)[keyof typeof SUBJECT];
export const SUBJECTS = Object.values(SUBJECT) as [Subject, ...Subject[]];

/** XEP_LOAI = yearly officer rating ("Xếp loại cán bộ"), individual only (see award_types.subject_scope). */
export const FORM = {
  DANH_HIEU: "DANH_HIEU",
  KHEN_THUONG: "KHEN_THUONG",
  XEP_LOAI: "XEP_LOAI",
} as const;
export type Form = (typeof FORM)[keyof typeof FORM];
export const FORMS = Object.values(FORM) as [Form, ...Form[]];

/** award_types.subject_scope: CA_HAI applies to both subjects. */
export const SUBJECT_SCOPE = { ...SUBJECT, CA_HAI: "CA_HAI" } as const;
export type SubjectScope = (typeof SUBJECT_SCOPE)[keyof typeof SUBJECT_SCOPE];
export const SUBJECT_SCOPES = Object.values(SUBJECT_SCOPE) as [SubjectScope, ...SubjectScope[]];

export const AUDIT_ACTION = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  IMPORT: "IMPORT",
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  LOCK: "LOCK",
  UNLOCK: "UNLOCK",
} as const;
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const UNIT_KIND = { CUC: "CUC", PHONG: "PHONG", THUY_DOAN: "THUY_DOAN" } as const;
export type UnitKind = (typeof UNIT_KIND)[keyof typeof UNIT_KIND];
export const UNIT_KINDS = Object.values(UNIT_KIND) as [UnitKind, ...UnitKind[]];

export const RANK_GROUPS = ["HA_SI_QUAN", "CAP_UY", "CAP_TA", "CAP_TUONG"] as const;
export const POSITION_LEVELS = ["DON_VI", "DOI", "CAN_BO"] as const;
