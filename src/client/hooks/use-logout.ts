import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useToast } from "../components/ui/toast-provider";
import { api } from "../lib/api-client";
import { errorMessage } from "../lib/api-error";

/** POST /api/auth/logout; always drops local cache and lands on /login. */
export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.post("/api/auth/logout", { skipAuthRedirect: true }),
    onSettled: (_data, error) => {
      if (error) toast(errorMessage(error), "error");
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
