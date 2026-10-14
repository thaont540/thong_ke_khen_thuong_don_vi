import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ERROR_CODE } from "../shared/schemas/api-common-schemas";
import { useToast } from "./components/ui/toast-provider";
import { setApiEventHandlers } from "./lib/api-client";
import { QUERY_KEYS } from "./query-client";

/** Root route: wires global API events (401 -> /login, 403 -> F01 + toast) to router + toast. */
export function RootShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const here = location.pathname + location.search;
    setApiEventHandlers({
      onUnauthorized: () => {
        queryClient.clear();
        if (location.pathname === "/login") return;
        navigate(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`, {
          replace: true,
        });
      },
      onForbidden: (error) => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
        // Forced password change: the auth guard redirects once /api/me is refetched.
        if (error.code === ERROR_CODE.PASSWORD_CHANGE_REQUIRED) return;
        toast(error.message, "error");
        if (location.pathname !== "/") navigate("/", { replace: true });
      },
    });
  }, [navigate, location, queryClient, toast]);

  return <Outlet />;
}
