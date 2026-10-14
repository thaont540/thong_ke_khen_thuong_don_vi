import { useQuery } from "@tanstack/react-query";
import { meResponseSchema } from "../../shared/schemas/auth-schemas";
import { api } from "../lib/api-client";
import { QUERY_KEYS } from "../query-client";

/** GET /api/me. 401 is surfaced as an error so route guards can redirect to /login. */
export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: ({ signal }) =>
      api.get("/api/me", { schema: meResponseSchema, skipAuthRedirect: true, signal }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
