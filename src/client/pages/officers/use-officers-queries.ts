import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  type OfficerInput,
  officerDetailSchema,
  officerListItemSchema,
  officerListResponseSchema,
} from "../../../shared/schemas/officer-schemas";
import { api } from "../../lib/api-client";

/** Lists, pickers and award rows embed officer names/counts. */
const AFFECTED_KEYS = [["officers"], ["officer-options"], ["officer-detail"], ["awards"]];

export type OfficersQuery = {
  unit_id: number | null;
  team_id: number | null;
  q: string;
  page: number;
  size: number;
};

export function useOfficersList(query: OfficersQuery) {
  return useQuery({
    queryKey: ["officers", "list", query],
    queryFn: ({ signal }) =>
      api.get("/api/officers", { query, schema: officerListResponseSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Used when the page is opened with `?edit=<id>` and the row may not be on the current page. */
export function useOfficerForEdit(id: number | null) {
  return useQuery({
    queryKey: ["officers", "edit", id],
    queryFn: ({ signal }) =>
      api.get(`/api/officers/${id}`, { schema: officerDetailSchema, signal }),
    enabled: id !== null,
  });
}

function useOfficerMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateOfficer = () =>
  useOfficerMutation((body: OfficerInput) =>
    api.post("/api/officers", { body, schema: officerListItemSchema }),
  );

export const useUpdateOfficer = () =>
  useOfficerMutation((v: { id: number; body: OfficerInput }) =>
    api.put(`/api/officers/${v.id}`, { body: v.body, schema: officerListItemSchema }),
  );

export const useDeleteOfficer = () =>
  useOfficerMutation((id: number) =>
    api.delete(`/api/officers/${id}`, {
      schema: z.object({ ok: z.literal(true), deleted_awards: z.number().int() }),
    }),
  );
