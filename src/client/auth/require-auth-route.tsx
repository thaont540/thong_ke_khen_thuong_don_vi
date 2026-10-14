import { Navigate, Outlet, useLocation } from "react-router";
import { useCurrentUser } from "../hooks/use-current-user";
import { isUnauthorized } from "../lib/api-error";

export const CHANGE_PASSWORD_PATH = "/change-password";

/** Session gate: 401 -> /login?next=, must_change_password -> /change-password only. */
export function RequireAuthRoute() {
  const { data: me, error, isPending, refetch } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <p className="empty">Đang tải…</p>;

  if (error) {
    if (isUnauthorized(error)) {
      const next = location.pathname + location.search;
      const target = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
      return <Navigate to={target} replace />;
    }
    return (
      <div className="empty">
        <p>{error.message}</p>
        <button type="button" className="btn" onClick={() => refetch()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (me.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  return <Outlet />;
}
