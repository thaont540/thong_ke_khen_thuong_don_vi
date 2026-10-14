import { ERROR_CODE, type ErrorCode } from "../../shared/schemas/api-common-schemas";

export type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

/** Thrown by routes/services; `error-handler` turns it into the JSON envelope. */
export class AppError extends Error {
  constructor(
    readonly status: AppErrorStatus,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    /** Extra top-level members of the `error` object (e.g. `duplicates`). */
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  static validation(message: string, fields?: Record<string, string>) {
    return new AppError(400, ERROR_CODE.VALIDATION, message, fields);
  }
  static unauthorized(message = "Chưa đăng nhập") {
    return new AppError(401, ERROR_CODE.UNAUTHORIZED, message);
  }
  static forbidden(message = "Bạn không có quyền thực hiện thao tác này") {
    return new AppError(403, ERROR_CODE.FORBIDDEN, message);
  }
  static notFound(message = "Không tìm thấy") {
    return new AppError(404, ERROR_CODE.NOT_FOUND, message);
  }
  static conflict(message: string, fields?: Record<string, string>) {
    return new AppError(409, ERROR_CODE.CONFLICT, message, fields);
  }
  static constraint(message: string) {
    return new AppError(422, ERROR_CODE.CONSTRAINT, message);
  }
}
