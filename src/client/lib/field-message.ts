import type { FieldError } from "react-hook-form";

const GENERIC_ZOD_TYPES = new Set(["too_small", "too_big", "invalid_type", "invalid_value"]);

/**
 * Message for a form field. Shared zod schemas only carry Vietnamese text on custom rules
 * (refine / regex); built-in checks fall back to the caller's Vietnamese `fallback`.
 */
export function fieldMessage(err: FieldError | undefined, fallback: string): string | undefined {
  if (!err) return undefined;
  if (err.type && GENERIC_ZOD_TYPES.has(err.type)) return fallback;
  return err.message || fallback;
}
