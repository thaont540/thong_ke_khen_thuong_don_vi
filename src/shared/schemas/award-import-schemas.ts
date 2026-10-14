import { z } from "zod";
import { idSchema } from "./api-common-schemas";

export const IMPORT_LOT_SIZE = 30;
export const IMPORT_MAX_ROWS = 1000;

/** Raw cell text as read in the browser; the server re-validates everything (spec §5). */
export const importRowSchema = z.object({
  row_number: z.number().int().positive(),
  subject: z.string().max(100),
  officer_code: z.string().max(50).optional().default(""),
  unit: z.string().max(200),
  team: z.string().max(300).optional().default(""),
  form: z.string().max(100),
  award_name: z.string().max(300),
  year: z.union([z.string().max(20), z.number()]),
  decision_number: z.string().max(200),
  decision_date: z.string().max(50),
  authority: z.string().max(200).optional().default(""),
  achievement: z.string().max(5000),
  note: z.string().max(1000).optional().default(""),
});

/** POST /api/awards/import: one lot of <= 30 rows. */
export const importRequestSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  total_rows: z.number().int().min(1).max(IMPORT_MAX_ROWS),
  /** Omitted on the first lot; the server creates the batch and returns its id. */
  batch_id: idSchema.optional(),
  dry_run: z.boolean().optional().default(false),
  include_duplicates: z.boolean().optional().default(false),
  rows: z.array(importRowSchema).min(1).max(IMPORT_LOT_SIZE),
});

export const importRowResultSchema = z.object({
  row_number: z.number().int().positive(),
  status: z.enum(["OK", "ERROR", "DUPLICATE"]),
  errors: z.array(z.string()),
  duplicate_messages: z.array(z.string()),
  imported: z.boolean(),
  award_id: idSchema.optional(),
});

export const importResponseSchema = z.object({
  batch_id: idSchema.nullable(),
  imported_count: z.number().int().nonnegative(),
  results: z.array(importRowResultSchema),
});

export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportRequest = z.infer<typeof importRequestSchema>;
export type ImportRowResult = z.infer<typeof importRowResultSchema>;
export type ImportResponse = z.infer<typeof importResponseSchema>;
