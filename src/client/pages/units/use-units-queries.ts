import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type UnitUpsert,
  unitDetailSchema,
  unitListResponseSchema,
} from "../../../shared/schemas/unit-schemas";
import { api } from "../../lib/api-client";
import { QUERY_KEYS } from "../../query-client";

const UNITS_KEY = ["units"] as const;
/** Keys whose data embeds unit/team names or counts. */
const AFFECTED_KEYS = [QUERY_KEYS.master, UNITS_KEY, ["officers"], ["officer-options"], ["awards"]];

export type UnitsQuery = { q: string; page: number; size: number };

export function useUnitsList(query: UnitsQuery) {
  return useQuery({
    queryKey: [...UNITS_KEY, "list", query],
    queryFn: ({ signal }) =>
      api.get("/api/units", { query, schema: unitListResponseSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useUnitDetail(id: number | null) {
  return useQuery({
    queryKey: [...UNITS_KEY, "detail", id],
    queryFn: ({ signal }) => api.get(`/api/units/${id}`, { schema: unitDetailSchema, signal }),
    enabled: id !== null,
  });
}

function useUnitMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateUnit = () =>
  useUnitMutation((body: UnitUpsert) => api.post("/api/units", { body, schema: unitDetailSchema }));

export const useUpdateUnit = () =>
  useUnitMutation((v: { id: number; body: UnitUpsert }) =>
    api.put(`/api/units/${v.id}`, { body: v.body, schema: unitDetailSchema }),
  );

export const useDeleteUnit = () => useUnitMutation((id: number) => api.delete(`/api/units/${id}`));
