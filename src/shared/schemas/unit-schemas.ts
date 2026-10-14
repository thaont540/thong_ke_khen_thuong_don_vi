import { z } from "zod";
import { UNIT_KINDS } from "../domain-enums";
import { collapseSpaces } from "../normalize-text";
import { idSchema, pageSchema } from "./api-common-schemas";

const nameSchema = z.string().transform(collapseSpaces).pipe(z.string().min(1).max(200));

/** Team row inside a unit upsert: `id` present = rename existing (code kept), absent = new. */
export const teamInputSchema = z.object({ id: idSchema.optional(), name: nameSchema });

/** POST /api/units, PUT /api/units/:id (PUT sends the complete team list). */
export const unitUpsertSchema = z.object({
  code: z.string().trim().min(1).max(20),
  kind: z.enum(UNIT_KINDS),
  name: nameSchema,
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
  teams: z.array(teamInputSchema).max(50).default([]),
});

export const unitListItemSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  kind: z.enum(UNIT_KINDS),
  description: z.string().nullable(),
  team_count: z.number().int(),
  officer_count: z.number().int(),
  award_count: z.number().int(),
});

export const unitDetailSchema = unitListItemSchema.extend({
  teams: z.array(
    z.object({
      id: idSchema,
      code: z.string(),
      name: z.string(),
      officer_count: z.number().int(),
      award_count: z.number().int(),
    }),
  ),
});

export const unitListResponseSchema = pageSchema(unitListItemSchema);

export type UnitUpsert = z.infer<typeof unitUpsertSchema>;
export type UnitListItem = z.infer<typeof unitListItemSchema>;
export type UnitDetail = z.infer<typeof unitDetailSchema>;
