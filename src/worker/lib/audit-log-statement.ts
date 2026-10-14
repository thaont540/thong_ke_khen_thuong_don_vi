import type { AuditAction } from "../../shared/domain-enums";

export interface AuditEntry {
  userId: number | null;
  action: AuditAction;
  entity: string;
  /** Number, null, or "LAST_INSERT" to use `last_insert_rowid()` (statement must directly follow the INSERT). */
  entityId: number | null | "LAST_INSERT";
  /** Serialised as JSON. Never put passwords, hashes or tokens here. */
  detail?: Record<string, unknown>;
  /** Insert only when the previous batch statement changed rows (`changes() > 0`). */
  onlyIfPreviousChanged?: boolean;
}

/** Prepared INSERT into audit_logs, meant to be passed to `db.batch([...])` with the write itself. */
export function auditStatement(d1: D1Database, e: AuditEntry): D1PreparedStatement {
  const idExpr = e.entityId === "LAST_INSERT" ? "last_insert_rowid()" : "?";
  const where = e.onlyIfPreviousChanged ? " WHERE changes() > 0" : "";
  const binds: (string | number | null)[] = [e.userId, e.action, e.entity];
  if (e.entityId !== "LAST_INSERT") binds.push(e.entityId);
  binds.push(e.detail ? JSON.stringify(e.detail) : null);
  return d1
    .prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail)
       SELECT ?, ?, ?, ${idExpr}, ?${where}`,
    )
    .bind(...binds);
}
