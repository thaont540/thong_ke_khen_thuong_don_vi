import { Outlet } from "react-router";
import { SYSTEM_NAME } from "../../shared/system-name";
import { useCurrentUser } from "../hooks/use-current-user";
import { OfficerDetailModalHost } from "../officer-detail/officer-detail-modal-host";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

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
          <img className="brand-logo" src="/logo-64.png" width="32" height="38" alt="" />
          <span>{SYSTEM_NAME}</span>
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
