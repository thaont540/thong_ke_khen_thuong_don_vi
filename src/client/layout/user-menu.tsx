import { useNavigate } from "react-router";
import type { MeResponse } from "../../shared/schemas/auth-schemas";
import { CHANGE_PASSWORD_PATH } from "../auth/require-auth-route";
import { useLogout } from "../hooks/use-logout";

export const ROLE_LABEL = { ADMIN: "Quản trị", EDITOR: "Biên tập", VIEWER: "Xem" } as const;

/** Sidebar footer: họ tên, vai trò, Đổi mật khẩu, Đăng xuất (F07). */
export function UserMenu({ me }: { me: MeResponse }) {
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <div className="side-user">
      <div>
        <div className="who">{me.full_name}</div>
        <div className="role">{ROLE_LABEL[me.role]}</div>
      </div>
      <div className="side-user-actions">
        <button type="button" className="btn btn-sm" onClick={() => navigate(CHANGE_PASSWORD_PATH)}>
          Đổi mật khẩu
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
