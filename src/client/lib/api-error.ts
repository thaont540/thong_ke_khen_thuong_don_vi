import { ERROR_CODE } from "../../shared/schemas/api-common-schemas";

/** Typed failure of an /api call. `fields` carries per-field messages (409/422) for form setError. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const isApiError = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError;
export const isUnauthorized = (e: unknown) => isApiError(e) && e.status === 401;

export const NETWORK_ERROR_MESSAGE = "Không kết nối được máy chủ. Vui lòng thử lại.";
export const GENERIC_ERROR_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại.";

/** User-facing text for any thrown value. */
export function errorMessage(e: unknown): string {
  return isApiError(e) ? e.message : GENERIC_ERROR_MESSAGE;
}

export { ERROR_CODE };
