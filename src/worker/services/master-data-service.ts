import { normalizeText } from "../../shared/normalize-text";
import type {
  AuthorityDto,
  AwardTypeDto,
  AwardVariantDto,
  MasterDataDto,
  PositionDto,
  RankDto,
  TeamDto,
  UnitDto,
} from "../../shared/schemas/master-data-dto";

type Row<T> = Omit<T, "requires_variant"> & { requires_variant?: number };

/** Reads all 7 catalog tables in one `db.batch` (7 statements, ~70 rows). */
export async function getMasterData(d1: D1Database): Promise<MasterDataDto> {
  const [units, teams, ranks, positions, authorities, types, variants] = await d1.batch([
    d1.prepare(
      "SELECT id, code, name, kind, description, sort_order FROM units ORDER BY sort_order, id",
    ),
    d1.prepare("SELECT id, unit_id, code, name, sort_order FROM teams ORDER BY sort_order, id"),
    d1.prepare("SELECT id, code, name, rank_group, sort_order FROM ranks ORDER BY sort_order, id"),
    d1.prepare("SELECT id, code, name, level, sort_order FROM positions ORDER BY sort_order, id"),
    d1.prepare("SELECT id, code, name, sort_order FROM authorities ORDER BY sort_order, id"),
    d1.prepare(
      `SELECT id, code, name, form, subject_scope, default_authority_id, requires_variant, sort_order
         FROM award_types WHERE is_active = 1 ORDER BY sort_order, id`,
    ),
    d1.prepare(
      `SELECT id, award_type_id, code, name, sort_order
         FROM award_variants WHERE is_active = 1 ORDER BY sort_order, id`,
    ),
  ]);

  const teamRows = (teams?.results ?? []) as TeamDto[];
  const unitRows = (units?.results ?? []) as Omit<UnitDto, "teams">[];
  return {
    units: unitRows.map((u) => ({ ...u, teams: teamRows.filter((t) => t.unit_id === u.id) })),
    ranks: (ranks?.results ?? []) as RankDto[],
    positions: (positions?.results ?? []) as PositionDto[],
    authorities: (authorities?.results ?? []) as AuthorityDto[],
    award_types: ((types?.results ?? []) as Row<AwardTypeDto>[]).map((t) => ({
      ...t,
      requires_variant: t.requires_variant === 1,
    })) as AwardTypeDto[],
    award_variants: (variants?.results ?? []) as AwardVariantDto[],
  };
}

const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const byKeys = <T>(rows: T[], keys: (r: T) => string[]) => {
  const m = new Map<string, T>();
  for (const r of rows) for (const k of keys(r)) m.set(normalizeText(k), r);
  return m;
};

/** Lookup maps reused by awards services and Excel import (name matching per BR-07). */
export function buildMasterLookups(master: MasterDataDto) {
  const teams = master.units.flatMap((u) => u.teams);
  return {
    unitById: byId(master.units),
    teamById: byId(teams),
    rankById: byId(master.ranks),
    positionById: byId(master.positions),
    authorityById: byId(master.authorities),
    awardTypeById: byId(master.award_types),
    variantById: byId(master.award_variants),
    unitByNameOrCode: byKeys(master.units, (u) => [u.name, u.code]),
    authorityByName: byKeys(master.authorities, (a) => [a.name]),
    awardTypeByName: byKeys(master.award_types, (t) => [t.name]),
    variantByName: byKeys(master.award_variants, (v) => [v.name]),
  };
}
export type MasterLookups = ReturnType<typeof buildMasterLookups>;
