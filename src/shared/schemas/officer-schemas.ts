import { z } from "zod";
import { collapseSpaces } from "../normalize-text";
import { idSchema, pageSchema } from "./api-common-schemas";
import { awardRecordSchema } from "./award-schemas";

/** POST /api/officers, PUT /api/officers/:id (code is auto-generated, immutable). */
export const officerInputSchema = z.object({
  full_name: z.string().transform(collapseSpaces).pipe(z.string().min(1).max(100)),
  birth_year: z.number().int().min(1950).max(2010),
  badge_number: z.string().regex(/^\d{6}$/, "Số hiệu gồm đúng 6 chữ số"),
  rank_id: idSchema,
  position_id: idSchema,
  unit_id: idSchema,
  team_id: idSchema.nullable().default(null),
});

/** F05 list row. */
export const officerListItemSchema = z.object({
  id: idSchema,
  code: z.string(),
  full_name: z.string(),
  birth_year: z.number().int(),
  badge_number: z.string(),
  rank_id: idSchema,
  position_id: idSchema,
  unit_id: idSchema,
  team_id: idSchema.nullable(),
  award_count: z.number().int(),
});

/** Slim row for pickers (F03/F09) and import code lookup (F04). */
export const officerOptionSchema = z.object({
  id: idSchema,
  code: z.string(),
  full_name: z.string(),
  rank_id: idSchema,
  badge_number: z.string(),
  unit_id: idSchema,
  team_id: idSchema.nullable(),
});

/** F02: officer + full award history (year desc). */
export const officerDetailSchema = officerListItemSchema.omit({ award_count: true }).extend({
  awards: z.array(awardRecordSchema),
});

export const officerListResponseSchema = pageSchema(officerListItemSchema);
export const officerOptionsResponseSchema = z.object({ items: z.array(officerOptionSchema) });

export type OfficerInput = z.infer<typeof officerInputSchema>;
export type OfficerListItem = z.infer<typeof officerListItemSchema>;
export type OfficerOption = z.infer<typeof officerOptionSchema>;
export type OfficerDetail = z.infer<typeof officerDetailSchema>;
