import type { AwardRecord } from "../../shared/schemas/award-schemas";

/** Columns of one display row (F01 list, F02 history, F09 edit load); matches `awardRecordSchema`. */
export const AWARD_RECORD_COLUMNS = `
  a.id, a.subject, a.officer_id, o.full_name AS officer_name, rk.name AS officer_rank_name,
  a.unit_id, u.name AS unit_name, a.team_id, tm.name AS team_name,
  a.award_type_id, t.name AS award_type_name, t.form AS form,
  a.award_variant_id, v.name AS award_variant_name,
  a.year, a.decision_number, a.decision_date,
  a.authority_id, au.name AS authority_name, a.achievement, a.note, a.updated_at`;

export const AWARD_RECORD_JOINS = `
  FROM awards a
  JOIN award_types t ON t.id = a.award_type_id
  JOIN units u ON u.id = a.unit_id
  JOIN authorities au ON au.id = a.authority_id
  LEFT JOIN officers o ON o.id = a.officer_id
  LEFT JOIN ranks rk ON rk.id = o.rank_id
  LEFT JOIN teams tm ON tm.id = a.team_id
  LEFT JOIN award_variants v ON v.id = a.award_variant_id`;

export const AWARD_ORDER = "ORDER BY a.year DESC, a.id DESC";

/** D1 rows already have the DTO shape (column aliases above). */
export const toAwardRecord = (row: unknown): AwardRecord => row as AwardRecord;
