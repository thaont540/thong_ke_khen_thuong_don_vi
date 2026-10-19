import { z } from "zod";
import { isValidIsoDate } from "../date-format";
import { FORMS, SUBJECTS } from "../domain-enums";
import { idSchema } from "./api-common-schemas";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

const awardCommonShape = {
  award_type_id: idSchema,
  award_variant_id: idSchema.nullish().transform((v) => v ?? null),
  year: z.number().int().min(1990).max(2100),
  decision_number: trimmed(50),
  decision_date: z.string().refine(isValidIsoDate, "Ngày quyết định không hợp lệ"),
  authority_id: idSchema,
  achievement: trimmed(2000),
  note: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
  /** Resend with true after a 409 DUPLICATE to save anyway (BR-08). */
  confirm_duplicate: z.boolean().optional(),
};

/** PUT only: `updated_at` of the record as loaded; a stale value is rejected with 409. */
const updatedAtToken = { updated_at: z.string().trim().min(1).max(40) };

function buildAwardSchema<T extends z.ZodRawShape>(extra: T) {
  return z.discriminatedUnion("subject", [
    z.object({
      subject: z.literal("CA_NHAN"),
      officer_id: idSchema,
      ...awardCommonShape,
      ...extra,
    }),
    z.object({
      subject: z.literal("TAP_THE"),
      unit_id: idSchema,
      team_id: idSchema.nullish().transform((v) => v ?? null),
      ...awardCommonShape,
      ...extra,
    }),
  ]);
}

/**
 * POST /api/awards.
 * CA_NHAN: unit/team are derived from the officer server-side (BR-02).
 * TAP_THE: unit required, team null = whole unit.
 */
export const awardInputSchema = buildAwardSchema({});

/** PUT /api/awards/:id: same body plus the REQUIRED optimistic-concurrency token. */
export const awardUpdateSchema = buildAwardSchema(updatedAtToken);

/** One award row as listed (F01), shown in F02 history and loaded for edit (F09). */
export const awardRecordSchema = z.object({
  id: idSchema,
  subject: z.enum(SUBJECTS),
  officer_id: idSchema.nullable(),
  officer_name: z.string().nullable(),
  officer_rank_name: z.string().nullable(),
  unit_id: idSchema,
  unit_name: z.string(),
  team_id: idSchema.nullable(),
  team_name: z.string().nullable(),
  award_type_id: idSchema,
  award_type_name: z.string(),
  form: z.enum(FORMS),
  award_variant_id: idSchema.nullable(),
  award_variant_name: z.string().nullable(),
  year: z.number().int(),
  decision_number: z.string(),
  decision_date: z.string(),
  authority_id: idSchema,
  authority_name: z.string(),
  achievement: z.string(),
  note: z.string().nullable(),
  /** Optimistic-concurrency token: send back unchanged on PUT. */
  updated_at: z.string(),
});

export const awardStatsSchema = z.object({
  total: z.number().int(),
  danh_hieu: z.number().int(),
  khen_thuong: z.number().int(),
  xep_loai: z.number().int(),
  tap_the: z.number().int(),
  ca_nhan: z.number().int(),
});

/** GET /api/awards response. */
export const awardListResponseSchema = z.object({
  items: z.array(awardRecordSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  stats: awardStatsSchema,
});

/** One existing record that may duplicate the one being saved (BR-08). */
export const awardDuplicateSchema = z.object({
  id: idSchema,
  decision_number: z.string(),
  year: z.number().int(),
  /** Variant name for medals (e.g. "Huân chương Chiến công hạng Nhất"), else the type name. */
  type_name: z.string(),
});

/** 409 body for BR-08 duplicates on POST/PUT /api/awards. */
export const awardDuplicateErrorSchema = z.object({
  error: z.object({
    code: z.literal("DUPLICATE"),
    message: z.string(),
    duplicates: z.array(awardDuplicateSchema),
  }),
});

export const awardMutationResponseSchema = z.object({ id: idSchema });

export type AwardInput = z.infer<typeof awardInputSchema>;
export type AwardUpdateInput = z.infer<typeof awardUpdateSchema>;
export type AwardRecord = z.infer<typeof awardRecordSchema>;
export type AwardStats = z.infer<typeof awardStatsSchema>;
export type AwardDuplicate = z.infer<typeof awardDuplicateSchema>;
export type AwardDuplicateError = z.infer<typeof awardDuplicateErrorSchema>;
