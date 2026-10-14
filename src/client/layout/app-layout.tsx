import { Outlet } from "react-router";
import { useCurrentUser } from "../hooks/use-current-user";
import { OfficerDetailModalHost } from "../officer-detail/officer-detail-modal-host";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

// Quốc kỳ Việt Nam, tỉ lệ 3:2: nền đỏ, sao vàng năm cánh ở giữa (bán kính = 1/5 chiều dài).
const FLAG_STAR =
  "15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15";

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
            <svg viewBox="0 0 30 20">
              <rect width="30" height="20" fill="#DA251D" />
              <polygon points={FLAG_STAR} fill="#FFFF00" />
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
