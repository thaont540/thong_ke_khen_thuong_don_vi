import type { Context } from "hono";
import type { ZodType, z } from "zod";
import { AppError } from "./app-error";

/** Parses the JSON body with a zod schema; malformed JSON becomes 400 VALIDATION (never 500). */
export async function parseJsonBody<S extends ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw AppError.validation("Nội dung yêu cầu không phải JSON hợp lệ");
  }
  return schema.parse(raw);
}

/** Parses a `:id` path param as a positive integer, else 404. */
export function parseIdParam(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound();
  return id;
}
