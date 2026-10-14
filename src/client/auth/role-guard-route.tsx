import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { canAccessScreen, type Screen } from "../../shared/role-permissions";
import { useToast } from "../components/ui/toast-provider";
import { useCurrentUser } from "../hooks/use-current-user";

export const FORBIDDEN_MESSAGE = "Bạn không có quyền truy cập chức năng này";

function ForbiddenRedirect() {
  const toast = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    toast(FORBIDDEN_MESSAGE, "error");
    navigate("/", { replace: true });
  }, [toast, navigate]);
  return null;
}

/** Layout route: renders children only when the user's role may open `screen`. UI-only; API enforces. */
export function RoleGuardRoute({ screen }: { screen: Screen }) {
  const { data: me } = useCurrentUser();
  if (!me) return null;
  return canAccessScreen(me.role, screen) ? <Outlet /> : <ForbiddenRedirect />;
}
