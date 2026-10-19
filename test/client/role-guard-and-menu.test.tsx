import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../src/shared/domain-enums";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const menuLinks = async () => {
  const nav = await screen.findByRole("navigation", { name: "Điều hướng chính" });
  return within(nav).getAllByRole("link");
};

describe("menu visibility per role (spec §1)", () => {
  it.each<[Role, number]>([
    ["VIEWER", 2],
    ["EDITOR", 3],
    ["ADMIN", 6],
  ])("%s sees %i menu item(s)", async (role, count) => {
    mockApi({ "GET /api/me": { body: makeMe(role) } });
    renderApp("/");
    expect(await menuLinks()).toHaveLength(count);
  });

  it("shows name and role in the user menu with change-password and logout", async () => {
    mockApi({ "GET /api/me": { body: makeMe("EDITOR") } });
    renderApp("/");
    expect(await screen.findByText("Người EDITOR")).toBeInTheDocument();
    expect(screen.getByText("Biên tập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeInTheDocument();
  });
});

describe("route guards", () => {
  it("VIEWER opening /units is redirected to / with a forbidden toast", async () => {
    mockApi({ "GET /api/me": { body: makeMe("VIEWER") } });
    const { router } = renderApp("/units");
    expect(
      await screen.findByText("Bạn không có quyền truy cập chức năng này"),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(
      await screen.findByRole("heading", { name: /Danh hiệu, khen thưởng/ }),
    ).toBeInTheDocument();
  });

  it("EDITOR cannot open /users but can open /awards/new", async () => {
    mockApi({ "GET /api/me": { body: makeMe("EDITOR") } });
    const first = renderApp("/users");
    await screen.findByText("Bạn không có quyền truy cập chức năng này");
    expect(first.router.state.location.pathname).toBe("/");
    first.unmount();

    renderApp("/awards/new");
    expect(await screen.findByRole("heading", { name: "Thêm khen thưởng" })).toBeInTheDocument();
  });

  it("ADMIN can open /units", async () => {
    mockApi({ "GET /api/me": { body: makeMe("ADMIN") } });
    renderApp("/units");
    expect(await screen.findByRole("heading", { name: /Quản lý đơn vị/ })).toBeInTheDocument();
  });

  it("401 from /api/me redirects to /login keeping ?next", async () => {
    mockApi({ "GET /api/me": { status: 401, body: errorBody("UNAUTHORIZED", "Chưa đăng nhập") } });
    const { router } = renderApp("/officers");
    expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Fofficers");
  });

  it("must_change_password forces /change-password from any route", async () => {
    mockApi({ "GET /api/me": { body: makeMe("ADMIN", { must_change_password: true }) } });
    const { router } = renderApp("/users");
    expect(await screen.findByRole("heading", { name: "Đổi mật khẩu" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/change-password");
    expect(screen.getByText(/phải đổi mật khẩu|cần đổi mật khẩu/)).toBeInTheDocument();
  });
});
