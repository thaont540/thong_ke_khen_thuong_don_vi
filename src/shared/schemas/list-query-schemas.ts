import { z } from "zod";
import { FORMS, SUBJECTS } from "../domain-enums";
import { optionalIntParam, optionalTextParam } from "./api-common-schemas";

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 10;

export const paginationQuerySchema = z.object({
  page: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).default(1)),
  size: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  ),
});

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** F01 filters: GET /api/awards */
export const awardListQuerySchema = paginationQuerySchema.extend({
  unit_id: optionalIntParam,
  team_id: optionalIntParam,
  subject: z.preprocess(emptyToUndefined, z.enum(SUBJECTS).optional()),
  form: z.preprocess(emptyToUndefined, z.enum(FORMS).optional()),
  q: optionalTextParam,
});

/** F05 filters: GET /api/officers */
export const officerListQuerySchema = paginationQuerySchema.extend({
  unit_id: optionalIntParam,
  team_id: optionalIntParam,
  q: optionalTextParam,
});

/** F06 / F08 search: GET /api/units, GET /api/users */
export const searchListQuerySchema = paginationQuerySchema.extend({ q: optionalTextParam });

/** GET /api/officers/options (not paginated; ~hundreds of rows, optional narrowing) */
export const officerOptionsQuerySchema = z.object({
  unit_id: optionalIntParam,
  team_id: optionalIntParam,
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type AwardListQuery = z.infer<typeof awardListQuerySchema>;
export type OfficerListQuery = z.infer<typeof officerListQuerySchema>;
export type SearchListQuery = z.infer<typeof searchListQuerySchema>;
