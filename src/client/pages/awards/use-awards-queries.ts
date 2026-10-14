import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AwardInput,
  type AwardUpdateInput,
  awardListResponseSchema,
  awardMutationResponseSchema,
  awardRecordSchema,
} from "../../../shared/schemas/award-schemas";
import { officerOptionsResponseSchema } from "../../../shared/schemas/officer-schemas";
import { api } from "../../lib/api-client";
import { OFFICER_DETAIL_KEY } from "../../officer-detail/use-officer-detail";

export const AWARDS_KEY = ["awards"] as const;
const OFFICER_OPTIONS_KEY = ["officer-options"] as const;

export interface AwardsQuery {
  unit_id?: number | undefined;
  team_id?: number | undefined;
  subject?: string | undefined;
  form?: string | undefined;
  q?: string | undefined;
  page: number;
  size: number;
}

export function useAwardsList(query: AwardsQuery) {
  return useQuery({
    queryKey: [...AWARDS_KEY, "list", query],
    queryFn: ({ signal }) =>
      api.get("/api/awards", { query: { ...query }, schema: awardListResponseSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAward(id: number | null) {
  return useQuery({
    queryKey: [...AWARDS_KEY, "one", id],
    enabled: id !== null,
    queryFn: ({ signal }) => api.get(`/api/awards/${id}`, { schema: awardRecordSchema, signal }),
    staleTime: 0,
    gcTime: 0,
  });
}

/** All active officers once (compact); the form narrows by unit/team in memory. */
export function useOfficerOptions(enabled: boolean) {
  return useQuery({
    queryKey: OFFICER_OPTIONS_KEY,
    enabled,
    queryFn: ({ signal }) =>
      api.get("/api/officers/options", { schema: officerOptionsResponseSchema, signal }),
    staleTime: 60_000,
  });
}

function useAwardMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: AWARDS_KEY }),
        queryClient.invalidateQueries({ queryKey: OFFICER_DETAIL_KEY }),
      ]),
  });
}

export const useCreateAward = () =>
  useAwardMutation((body: AwardInput) =>
    api.post("/api/awards", { body, schema: awardMutationResponseSchema }),
  );

export const useUpdateAward = () =>
  useAwardMutation((v: { id: number; body: AwardUpdateInput }) =>
    api.put(`/api/awards/${v.id}`, { body: v.body, schema: awardMutationResponseSchema }),
  );

export const useDeleteAward = () =>
  useAwardMutation((id: number) => api.delete(`/api/awards/${id}`));
