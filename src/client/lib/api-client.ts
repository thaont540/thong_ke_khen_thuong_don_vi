import type { z } from "zod";
import { apiErrorSchema } from "../../shared/schemas/api-common-schemas";
import { ApiRequestError, GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "./api-error";

type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiEventHandlers {
  /** 401 on any call except those flagged `skipAuthRedirect`. */
  onUnauthorized: () => void;
  /** 403 on any call. */
  onForbidden: (error: ApiRequestError) => void;
}

export interface ApiRequestOptions<T> {
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  /** zod schema validating the success payload (omit for empty bodies). */
  schema?: z.ZodType<T>;
  /** Caller handles 401/403 itself (login, change-password, /api/me): no global redirect/toast. */
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
}

let handlers: ApiEventHandlers = { onUnauthorized: () => {}, onForbidden: () => {} };

export function setApiEventHandlers(next: ApiEventHandlers): void {
  handlers = next;
}

function buildUrl(path: string, query?: ApiRequestOptions<unknown>["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function toApiError(res: Response): Promise<ApiRequestError> {
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return new ApiRequestError(res.status, "INTERNAL", GENERIC_ERROR_MESSAGE);
  }
  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) return new ApiRequestError(res.status, "INTERNAL", GENERIC_ERROR_MESSAGE);
  const { code, message, fields } = parsed.data.error;
  const {
    code: _c,
    message: _m,
    fields: _f,
    ...extra
  } = (payload as { error: object }).error as Record<string, unknown>;
  return new ApiRequestError(res.status, code, message, fields, extra);
}

export async function apiRequest<T = void>(
  method: Method,
  path: string,
  opts: ApiRequestOptions<T> = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: "same-origin",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiRequestError(0, "NETWORK", NETWORK_ERROR_MESSAGE);
  }

  if (!res.ok) {
    const err = await toApiError(res);
    if (res.status === 401 && !opts.skipAuthRedirect) handlers.onUnauthorized();
    if (res.status === 403 && !opts.skipAuthRedirect) handlers.onForbidden(err);
    throw err;
  }

  if (!opts.schema) return undefined as T;
  return opts.schema.parse(await res.json());
}

export const api = {
  get: <T>(path: string, opts?: ApiRequestOptions<T>) => apiRequest<T>("GET", path, opts),
  post: <T = void>(path: string, opts?: ApiRequestOptions<T>) => apiRequest<T>("POST", path, opts),
  put: <T = void>(path: string, opts?: ApiRequestOptions<T>) => apiRequest<T>("PUT", path, opts),
  delete: <T = void>(path: string, opts?: ApiRequestOptions<T>) =>
    apiRequest<T>("DELETE", path, opts),
};
