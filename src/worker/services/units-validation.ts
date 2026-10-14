import { normalizeText } from "../../shared/normalize-text";
import { AppError } from "../lib/app-error";

/** BR-06: unit code and name are unique case-insensitively (Unicode-aware, unlike the NOCASE column). */
export async function assertUnitFieldsUnique(
  d1: D1Database,
  input: { code: string; name: string },
  selfId: number | null,
): Promise<void> {
  const { results } = await d1
    .prepare("SELECT id, code, name FROM units")
    .all<{ id: number; code: string; name: string }>();
  const code = normalizeText(input.code);
  const name = normalizeText(input.name);
  const fields: Record<string, string> = {};
  for (const r of results) {
    if (r.id === selfId) continue;
    if (normalizeText(r.code) === code) fields.code = "Mã đơn vị đã tồn tại";
    if (normalizeText(r.name) === name) fields.name = "Tên đơn vị đã tồn tại";
  }
  if (Object.keys(fields).length > 0) {
    throw AppError.conflict("Mã hoặc tên đơn vị đã tồn tại", fields);
  }
}

/** BR-06: team names are unique inside one unit. Keys are `teams.<index>`. */
export function assertTeamNamesUnique(teams: readonly { name: string }[]): void {
  const seen = new Set<string>();
  const fields: Record<string, string> = {};
  teams.forEach((t, i) => {
    const key = normalizeText(t.name);
    if (seen.has(key)) fields[`teams.${i}`] = "Tên đội bị trùng trong đơn vị";
    seen.add(key);
  });
  if (Object.keys(fields).length > 0) {
    throw AppError.conflict("Tên đội bị trùng trong đơn vị", fields);
  }
}
