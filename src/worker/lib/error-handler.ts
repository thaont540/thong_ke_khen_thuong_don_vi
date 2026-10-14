import type { Context } from "hono";
import { ZodError } from "zod";
import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";
import { AppError } from "./app-error";

/** RAISE(ABORT, ...) texts from migration 0001 mapped to user-facing messages. */
const TRIGGER_MESSAGES = [
  "Đội không thuộc đơn vị của cán bộ",
  "Đội không thuộc đơn vị",
  "Danh hiệu / khen thưởng không áp dụng cho đối tượng này",
  "Cần chọn loại cho hình thức khen thưởng này",
  "Loại không thuộc hình thức khen thưởng đã chọn",
  "Đơn vị còn cán bộ hoặc khen thưởng",
  "Đội còn cán bộ hoặc khen thưởng",
] as const;

/**
 * Maps a D1 error (message format `D1_ERROR: <RAISE text>: SQLITE_CONSTRAINT ...`) to AppError.
 * Trigger -> 422 CONSTRAINT, UNIQUE -> 409 CONFLICT, other constraint -> generic 422.
 * Returns null when the error is not a D1 constraint failure.
 */
export function mapD1Error(err: unknown): AppError | null {
  const msg = err instanceof Error ? err.message : "";
  if (!msg.includes("SQLITE_CONSTRAINT") && !msg.includes("UNIQUE constraint failed")) return null;
  const trigger = TRIGGER_MESSAGES.find((t) => msg.includes(t));
  if (trigger) return AppError.constraint(trigger);
  if (msg.includes("UNIQUE constraint failed")) {
    return AppError.conflict("Dữ liệu bị trùng với bản ghi đã có");
  }
  return AppError.constraint("Dữ liệu không hợp lệ");
}

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export function handleError(err: unknown, c: Context): Response {
  const known =
    err instanceof AppError
      ? err
      : err instanceof ZodError
        ? AppError.validation("Dữ liệu không hợp lệ", zodFields(err))
        : mapD1Error(err);
  if (known) {
    return c.json(
      {
        error: {
          code: known.code,
          message: known.message,
          ...(known.fields ? { fields: known.fields } : {}),
          ...known.extra,
        },
      },
      known.status,
    );
  }
  console.error(err);
  return c.json({ error: { code: ERROR_CODE.INTERNAL, message: "Lỗi hệ thống" } }, 500);
}
