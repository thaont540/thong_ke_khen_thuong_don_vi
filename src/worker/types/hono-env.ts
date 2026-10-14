import type { Role } from "../../shared/domain-enums";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface SessionInfo {
  tokenHash: string;
  expiresAt: string;
}

/** Variables are populated by the auth middleware (phase 03). */
export interface AppEnv {
  Bindings: Env;
  Variables: { user: SessionUser; session: SessionInfo };
}
