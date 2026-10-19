import { z } from "zod";
import { FORMS, POSITION_LEVELS, RANK_GROUPS, SUBJECT_SCOPES, UNIT_KINDS } from "../domain-enums";

const id = z.number().int().positive();

export const teamDtoSchema = z.object({
  id,
  unit_id: id,
  code: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
});

export const unitDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  kind: z.enum(UNIT_KINDS),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  teams: z.array(teamDtoSchema),
});

export const rankDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  rank_group: z.enum(RANK_GROUPS),
  sort_order: z.number().int(),
});

export const positionDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  level: z.enum(POSITION_LEVELS),
  sort_order: z.number().int(),
});

export const authorityDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
});

export const awardTypeDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  form: z.enum(FORMS),
  subject_scope: z.enum(SUBJECT_SCOPES),
  default_authority_id: id,
  requires_variant: z.boolean(),
  sort_order: z.number().int(),
});

export const awardVariantDtoSchema = z.object({
  id,
  award_type_id: id,
  code: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
});

/** GET /api/master response. Award types / variants: active only. */
export const masterDataDtoSchema = z.object({
  units: z.array(unitDtoSchema),
  ranks: z.array(rankDtoSchema),
  positions: z.array(positionDtoSchema),
  authorities: z.array(authorityDtoSchema),
  award_types: z.array(awardTypeDtoSchema),
  award_variants: z.array(awardVariantDtoSchema),
});

export type TeamDto = z.infer<typeof teamDtoSchema>;
export type UnitDto = z.infer<typeof unitDtoSchema>;
export type RankDto = z.infer<typeof rankDtoSchema>;
export type PositionDto = z.infer<typeof positionDtoSchema>;
export type AuthorityDto = z.infer<typeof authorityDtoSchema>;
export type AwardTypeDto = z.infer<typeof awardTypeDtoSchema>;
export type AwardVariantDto = z.infer<typeof awardVariantDtoSchema>;
export type MasterDataDto = z.infer<typeof masterDataDtoSchema>;
