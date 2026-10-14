import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./lib/api-error";

export const QUERY_KEYS = {
  me: ["me"] as const,
  master: ["master"] as const,
  users: ["users"] as const,
};

/** 4xx responses are final; only transient failures retry. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 1,
      },
    },
  });
}
