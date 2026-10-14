import { useQuery } from "@tanstack/react-query";
import { masterDataDtoSchema } from "../../shared/schemas/master-data-dto";
import { api } from "../lib/api-client";
import { QUERY_KEYS } from "../query-client";

/** GET /api/master. Cached forever; unit/team mutations invalidate QUERY_KEYS.master. */
export function useMasterData() {
  return useQuery({
    queryKey: QUERY_KEYS.master,
    queryFn: ({ signal }) => api.get("/api/master", { schema: masterDataDtoSchema, signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
