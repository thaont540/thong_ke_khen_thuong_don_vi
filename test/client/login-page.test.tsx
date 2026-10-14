import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeNextPath } from "../../src/client/pages/login-page";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const unauth = {
  "GET /api/me": { status: 401, body: errorBody("UNAUTHORIZED", "Chưa đăng nhập") },
};

async function fill(user: ReturnType<typeof userEvent.setup>, name: string, pw: string) {
  await user.type(await screen.findByLabelText(/Tên đăng nhập/), name);
  await user.type(screen.getByLabelText(/Mật khẩu/), pw);
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("login page", () => {
  it("requires both fields before calling the API", async () => {
    const api = mockApi(unauth);
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Nhập tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByText("Nhập mật khẩu")).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "/api/auth/login")).toBe(false);
  });

  it("shows the generic server message on bad credentials and stays on /login", async () => {
    mockApi({
      ...unauth,
      "POST /api/auth/login": {
        status: 401,
        body: errorBody("UNAUTHORIZED", "Tên đăng nhập hoặc mật khẩu không đúng"),
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");
    await fill(user, "admin", "sai-mat-khau");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tên đăng nhập hoặc mật khẩu không đúng",
    );
    expect(router.state.location.pathname).toBe("/login");
  });

  it("shows the locked-account message (423)", async () => {
    mockApi({
      ...unauth,
      "POST /api/auth/login": {
        status: 423,
        body: errorBody("ACCOUNT_LOCKED", "Tài khoản đang bị khóa"),
      },
    });
    const user = userEvent.setup();
    renderApp("/login");
    await fill(user, "admin", "mat-khau-dai-1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản đang bị khóa");
  });

  it("logs in and follows ?next", async () => {
    const api = mockApi({
      ...unauth,
      "POST /api/auth/login": { body: makeMe("ADMIN") },
      "GET /api/users": { body: { items: [], total: 0, page: 1, size: 10 } },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login?next=%2Fusers");
    await fill(user, "admin", "mat-khau-dai-1");
    await waitFor(() => expect(router.state.location.pathname).toBe("/users"));
    expect(api.calls.find((c) => c.path === "/api/auth/login")?.body).toEqual({
      username: "admin",
      password: "mat-khau-dai-1",
    });
  });

  it("sends a user who must change password to /change-password", async () => {
    mockApi({
      ...unauth,
      "POST /api/auth/login": { body: makeMe("EDITOR", { must_change_password: true }) },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login?next=%2Fusers");
    await fill(user, "bientap", "tam-thoi-12345");
    await waitFor(() => expect(router.state.location.pathname).toBe("/change-password"));
  });
});

describe("safeNextPath", () => {
  it("accepts local paths only", () => {
    expect(safeNextPath("/users?x=1")).toBe("/users?x=1");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
