import { useQuery } from "@tanstack/react-query";
import { officerDetailSchema } from "../../shared/schemas/officer-schemas";
import { api } from "../lib/api-client";

export const OFFICER_DETAIL_KEY = ["officer"] as const;

/** GET /api/officers/:id (officer + award history). Invalidated by award mutations. */
export function useOfficerDetail(id: number | null) {
  return useQuery({
    queryKey: [...OFFICER_DETAIL_KEY, id],
    enabled: id !== null,
    queryFn: ({ signal }) =>
      api.get(`/api/officers/${id}`, { schema: officerDetailSchema, signal }),
    staleTime: 30_000,
  });
}
