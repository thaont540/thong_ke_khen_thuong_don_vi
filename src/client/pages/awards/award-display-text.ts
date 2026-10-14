import type { AwardRecord } from "../../../shared/schemas/award-schemas";

/** Main label of the awarded party: officer, team, or unit. */
export const awardSubjectName = (r: AwardRecord): string =>
  r.officer_name ?? r.team_name ?? r.unit_name;

/** Sub line of the awarded party (F01 spec): rank + unit/team, unit/team, or "Cấp đơn vị". */
export function awardPlaceLine(r: AwardRecord): string {
  const place = r.team_name ? `${r.unit_name} / ${r.team_name}` : r.unit_name;
  if (r.subject === "CA_NHAN")
    return r.officer_rank_name ? `${r.officer_rank_name}, ${place}` : place;
  return r.team_name ? place : "Cấp đơn vị";
}

/** Medals show the variant (their "loại"), everything else the type name. */
export const awardTitle = (r: AwardRecord): string => r.award_variant_name ?? r.award_type_name;
