import { normalizeText } from "../normalize-text";
import type { MasterDataDto, TeamDto, UnitDto } from "../schemas/master-data-dto";

/** Officer fields the import needs; `OfficerOption` (client) and DB rows (server) both satisfy it. */
export interface ImportOfficer {
  id: number;
  code: string;
  full_name: string;
  unit_id: number;
  team_id: number | null;
}

/** Normalized (BR-07) lookups built once per file (browser) or per lot (Worker). */
export interface ImportLookups {
  master: MasterDataDto;
  unitByKey: ReadonlyMap<string, UnitDto>;
  teamsByUnit: ReadonlyMap<number, ReadonlyMap<string, TeamDto>>;
  officerByCode: ReadonlyMap<string, ImportOfficer>;
  authorityByName: ReadonlyMap<string, number>;
  variantByName: ReadonlyMap<string, MasterDataDto["award_variants"][number]>;
}

export const normalizeOfficerCode = (code: string): string => normalizeText(code);

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
  return {
    master,
    unitByKey,
    teamsByUnit,
    officerByCode: new Map(officers.map((o) => [normalizeOfficerCode(o.code), o])),
    authorityByName: new Map(master.authorities.map((a) => [normalizeText(a.name), a.id])),
    variantByName: new Map(master.award_variants.map((v) => [normalizeText(v.name), v])),
  };
}
