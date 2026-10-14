import { Fragment } from "react";
import { NavLink } from "react-router";
import type { Role } from "../../shared/domain-enums";
import { canAccessScreen, type Screen } from "../../shared/role-permissions";

interface NavItem {
  screen: Screen;
  to: string;
  label: string;
  end?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Khen thưởng",
    items: [
      { screen: "awards-list", to: "/", label: "Danh hiệu, khen thưởng", end: true },
      { screen: "award-create", to: "/awards/new", label: "Thêm khen thưởng" },
    ],
  },
  {
    title: "Danh mục",
    items: [
      { screen: "officers", to: "/officers", label: "Quản lý cán bộ" },
      { screen: "units", to: "/units", label: "Quản lý đơn vị" },
    ],
  },
  { title: "Hệ thống", items: [{ screen: "users", to: "/users", label: "Quản lý người dùng" }] },
];

export function SidebarNav({ role }: { role: Role }) {
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => canAccessScreen(role, i.screen));
        if (items.length === 0) return null;
        return (
          <Fragment key={group.title}>
            <div className="nav-group">{group.title}</div>
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end}>
                {i.label}
              </NavLink>
            ))}
          </Fragment>
        );
      })}
    </nav>
  );
}
