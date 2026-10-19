import { normalizeText } from "../normalize-text";
import type { MasterDataDto, TeamDto, UnitDto } from "../schemas/master-data-dto";

/** Officer fields the import needs; `OfficerOption` (client) and DB rows (server) both satisfy it. */
export interface ImportOfficer {
  id: number;
  full_name: string;
  unit_id: number;
  team_id: number | null;
}

/** Normalized (BR-07) lookups built once per file (browser) or per lot (Worker). */
export interface ImportLookups {
  master: MasterDataDto;
  unitByKey: ReadonlyMap<string, UnitDto>;
  teamsByUnit: ReadonlyMap<number, ReadonlyMap<string, TeamDto>>;
  /** Active officers by normalized full name (several officers may share a name). */
  officersByName: ReadonlyMap<string, readonly ImportOfficer[]>;
  rankByName: ReadonlyMap<string, number>;
  positionByName: ReadonlyMap<string, number>;
  authorityByName: ReadonlyMap<string, number>;
  variantByName: ReadonlyMap<string, MasterDataDto["award_variants"][number]>;
}

export function buildImportLookups(
  master: MasterDataDto,
  officers: readonly ImportOfficer[],
): ImportLookups {
  const unitByKey = new Map<string, UnitDto>();
  const teamsByUnit = new Map<number, Map<string, TeamDto>>();
  for (const unit of master.units) {
    unitByKey.set(normalizeText(unit.name), unit);
    unitByKey.set(normalizeText(unit.code), unit);
    const teams = new Map<string, TeamDto>();
    for (const team of unit.teams) teams.set(normalizeText(team.name), team);
    teamsByUnit.set(unit.id, teams);
  }
  const officersByName = new Map<string, ImportOfficer[]>();
  for (const o of officers) {
    const key = normalizeText(o.full_name);
    officersByName.set(key, [...(officersByName.get(key) ?? []), o]);
  }
  return {
    master,
    unitByKey,
    teamsByUnit,
    officersByName,
    rankByName: new Map(master.ranks.map((r) => [normalizeText(r.name), r.id])),
    positionByName: new Map(master.positions.map((p) => [normalizeText(p.name), p.id])),
    authorityByName: new Map(master.authorities.map((a) => [normalizeText(a.name), a.id])),
    variantByName: new Map(master.award_variants.map((v) => [normalizeText(v.name), v])),
  };
}
