import { Outlet } from "react-router";
import { useCurrentUser } from "../hooks/use-current-user";
import { OfficerDetailModalHost } from "../officer-detail/officer-detail-modal-host";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

const STAR = "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z";

export function AppLayout() {
  const { data: me } = useCurrentUser();
  if (!me) return null;
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="#24503F">
              <path d={STAR} />
            </svg>
          </span>
          Thi đua, khen thưởng
        </div>
        <SidebarNav role={me.role} />
        <UserMenu me={me} />
      </aside>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <OfficerDetailModalHost />
    </div>
  );
}
