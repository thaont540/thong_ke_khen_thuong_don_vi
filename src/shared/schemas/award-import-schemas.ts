import { z } from "zod";
import { idSchema } from "./api-common-schemas";

export const IMPORT_LOT_SIZE = 30;
export const IMPORT_MAX_ROWS = 1000;

/** Longest cell text accepted on the wire; real field limits are enforced by the row validator. */
export const IMPORT_CELL_MAX = 5000;
const cell = z.string().max(IMPORT_CELL_MAX);

/** Raw cell text as read in the browser; the server re-validates everything (spec §5). */
export const importRowSchema = z.object({
  row_number: z.number().int().positive(),
  subject: cell,
  officer_code: cell.optional().default(""),
  unit: cell,
  team: cell.optional().default(""),
  form: cell,
  award_name: cell,
  year: z.union([cell, z.number()]),
  decision_number: cell,
  decision_date: cell,
  authority: cell.optional().default(""),
  achievement: cell,
  note: cell.optional().default(""),
});

/** POST /api/awards/import: one lot of <= 30 rows. */
export const importRequestSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  total_rows: z.number().int().min(1).max(IMPORT_MAX_ROWS),
  /** Omitted on the first lot; the server creates the batch and returns its id. */
  batch_id: idSchema.optional(),
  dry_run: z.boolean().optional().default(false),
  include_duplicates: z.boolean().optional().default(false),
  /** Rows the browser already rejected (informational; stored when the batch row is created). */
  client_error_rows: z.number().int().min(0).max(IMPORT_MAX_ROWS).optional().default(0),
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
