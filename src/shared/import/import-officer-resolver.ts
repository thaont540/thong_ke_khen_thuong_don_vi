import { collapseSpaces, normalizeText } from "../normalize-text";
import type { ImportRow } from "../schemas/award-import-schemas";
import type { ImportLookups } from "./import-lookup-maps";
import { type NewOfficerDraft, type PendingOfficers } from "./import-pending-officers";

export const FULL_NAME_MAX = 100;

export interface ImportPlace {
  unit: { id: number; name: string } | null;
  team: { id: number; name: string } | null;
}

export interface ResolvedOfficer {
  /** Real officer id, or the negative placeholder id of `draft`. */
  id: number;
  full_name: string;
  /** Set when the officer does not exist yet and will be created on commit. */
  draft: NewOfficerDraft | null;
}

const text = (v: string | undefined): string => collapseSpaces(v ?? "");

/** Rank or position cell of a new officer: must match a catalog name (BR-07 normalized). */
function catalogId(
  raw: string,
  byName: ReadonlyMap<string, number>,
  missing: string,
  label: string,
  errors: string[],
): number | null {
  if (!raw) {
    errors.push(missing);
    return null;
  }
  const id = byName.get(normalizeText(raw)) ?? null;
  if (id === null) errors.push(`Không tìm thấy ${label} "${raw}"`);
  return id;
}

/**
 * Officer of a Cá nhân row: name + unit (+ team). One active match is used, none creates a new
 * officer (rank and position required), several is an error. Rank/position of an existing officer
 * are informational only. Caller guarantees `place.unit` is resolved (team error reported already).
 */
export function resolveImportOfficer(
  row: ImportRow,
  lk: ImportLookups,
  place: ImportPlace,
  pending: PendingOfficers,
  errors: string[],
): ResolvedOfficer | null {
  const name = text(row.full_name);
  if (!name) {
    errors.push("Cá nhân cần có họ tên");
    return null;
  }
  const { unit, team } = place;
  if (!unit) return null;
  const key = normalizeText(name);
  const existing = (lk.officersByName.get(key) ?? []).filter(
    (o) => o.unit_id === unit.id && (!team || o.team_id === team.id),
  );
  const queued = pending.find(key, unit.id, team ? team.id : undefined);
  const total = existing.length + queued.length;
  if (total > 1) {
    const where = team ? `${team.name} (${unit.name})` : unit.name;
    errors.push(`Có ${total} cán bộ trùng tên "${name}" trong ${where} — vui lòng kiểm tra`);
    return null;
  }
  const found = existing[0];
  if (found) return { id: found.id, full_name: found.full_name, draft: null };
  const draft = queued[0];
  if (draft) return { id: draft.temp_id, full_name: draft.full_name, draft };

  const before = errors.length;
  const rankId = catalogId(
    text(row.rank),
    lk.rankByName,
    "Cá nhân cần có cấp bậc",
    "cấp bậc",
    errors,
  );
  const positionId = catalogId(
    text(row.position),
    lk.positionByName,
    "Cá nhân cần có chức vụ",
    "chức vụ",
    errors,
  );
  if (name.length > FULL_NAME_MAX) errors.push(`Họ tên tối đa ${FULL_NAME_MAX} ký tự`);
  if (errors.length > before || rankId === null || positionId === null) return null;
  const created = pending.add(key, {
    full_name: name,
    rank_id: rankId,
    position_id: positionId,
    unit_id: unit.id,
    team_id: team?.id ?? null,
  });
  return { id: created.temp_id, full_name: created.full_name, draft: created };
}
