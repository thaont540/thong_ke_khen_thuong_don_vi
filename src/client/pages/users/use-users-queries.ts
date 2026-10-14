import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  resetPasswordResponseSchema,
  type UserCreate,
  type UserUpdate,
  userDtoSchema,
  userListResponseSchema,
} from "../../../shared/schemas/user-schemas";
import { api } from "../../lib/api-client";
import { QUERY_KEYS } from "../../query-client";

export type UsersQuery = { q: string; page: number; size: number };

export function useUsersList(query: UsersQuery) {
  return useQuery({
    queryKey: [...QUERY_KEYS.users, query],
    queryFn: ({ signal }) =>
      api.get("/api/users", { query, schema: userListResponseSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

function useUsersMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users }),
  });
}

export const useCreateUser = () =>
  useUsersMutation((body: UserCreate) => api.post("/api/users", { body, schema: userDtoSchema }));

export const useUpdateUser = () =>
  useUsersMutation((v: { id: number; body: UserUpdate }) =>
    api.put(`/api/users/${v.id}`, { body: v.body, schema: userDtoSchema }),
  );

export const useResetUserPassword = () =>
  useUsersMutation((id: number) =>
    api.post(`/api/users/${id}/reset-password`, { schema: resetPasswordResponseSchema }),
  );

export const useDeleteUser = () => useUsersMutation((id: number) => api.delete(`/api/users/${id}`));
