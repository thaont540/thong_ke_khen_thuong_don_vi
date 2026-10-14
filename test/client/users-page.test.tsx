import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorBody, makeMe, makeUser, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const admin = makeMe("ADMIN", { id: 1, username: "admin1" });
const selfRow = makeUser({ id: 1, username: "admin1", full_name: "Quản Trị", role: "ADMIN" });
const editorRow = makeUser();
const page = (items = [selfRow, editorRow]) => ({
  body: { items, total: items.length, page: 1, size: 10 },
});

describe("F08 users page", () => {
  it("lists users; own row has no lock / reset / delete", async () => {
    mockApi({ "GET /api/me": { body: admin }, "GET /api/users": page() });
    renderApp("/users");
    expect(await screen.findByText("bien.tap")).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1–2 trong 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa admin1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khóa admin1/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Đặt lại mật khẩu admin1/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa admin1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khóa bien.tap" })).toBeInTheDocument();
  });

  it("searches via the q param", async () => {
    const api = mockApi({ "GET /api/me": { body: admin }, "GET /api/users": page() });
    const user = userEvent.setup();
    renderApp("/users");
    await user.type(await screen.findByLabelText("Tìm kiếm"), "bien");
    await waitFor(() =>
      expect(api.calls.some((c) => c.path === "/api/users" && c.query.get("q") === "bien")).toBe(
        true,
      ),
    );
  });

  it("creates a user and shows the generated temp password once, with copy", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page(),
      "POST /api/users": ({ body }) => ({
        status: 201,
        body: makeUser({ id: 9, username: (body as { username: string }).username }),
      }),
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Thêm người dùng" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm người dùng" }));
    await user.type(form.getByLabelText(/Tên đăng nhập/), "nguoi.moi");
    await user.type(form.getByLabelText(/Họ tên/), "Người Mới");
    await user.click(form.getByRole("button", { name: "Tạo ngẫu nhiên" }));
    const generated = (form.getByLabelText(/Mật khẩu tạm/) as HTMLInputElement).value;
    expect(generated).toHaveLength(14);
    await user.click(form.getByRole("button", { name: "Lưu" }));

    const result = await screen.findByRole("dialog", { name: "Đã tạo người dùng" });
    expect(within(result).getByTestId("temp-password")).toHaveTextContent(generated);
    expect(api.calls.find((c) => c.method === "POST" && c.path === "/api/users")?.body).toEqual({
      username: "nguoi.moi",
      full_name: "Người Mới",
      role: "VIEWER",
      temp_password: generated,
    });
    await user.click(within(result).getByRole("button", { name: "Sao chép" }));
    expect(await within(result).findByText("Đã sao chép")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(generated);

    await user.click(within(result).getAllByRole("button", { name: "Đóng" }).at(-1) as HTMLElement);
    expect(screen.queryByText(generated)).not.toBeInTheDocument();
  });

  it("validates the temp password length before submitting", async () => {
    const api = mockApi({ "GET /api/me": { body: admin }, "GET /api/users": page() });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Thêm người dùng" }));
    const form = within(screen.getByRole("dialog"));
    await user.type(form.getByLabelText(/Tên đăng nhập/), "nguoi.moi");
    await user.type(form.getByLabelText(/Họ tên/), "Người Mới");
    await user.type(form.getByLabelText(/Mật khẩu tạm/), "ngan");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Mật khẩu tạm tối thiểu 10 ký tự")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("maps a duplicate username conflict onto the field", async () => {
    mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page(),
      "POST /api/users": {
        status: 409,
        body: errorBody("DUPLICATE", "Tên đăng nhập đã tồn tại", {
          username: "Tên đăng nhập đã tồn tại",
        }),
      },
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Thêm người dùng" }));
    const form = within(screen.getByRole("dialog"));
    await user.type(form.getByLabelText(/Tên đăng nhập/), "bien.tap");
    await user.type(form.getByLabelText(/Họ tên/), "Trùng");
    await user.type(form.getByLabelText(/Mật khẩu tạm/), "mat-khau-tam-12");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Tên đăng nhập đã tồn tại")).toBeInTheDocument();
  });

  it("edit modal locks username, and role for own account", async () => {
    mockApi({ "GET /api/me": { body: admin }, "GET /api/users": page() });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Sửa admin1" }));
    const form = within(screen.getByRole("dialog", { name: "Sửa người dùng" }));
    expect(form.getByLabelText(/Tên đăng nhập/)).toBeDisabled();
    expect(form.getByLabelText(/Vai trò/)).toBeDisabled();
  });

  it("locks an account after confirmation via PUT is_active=false", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page(),
      "PUT /api/users/2": { body: makeUser({ is_active: false }) },
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Khóa bien.tap" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Khóa" }));
    expect(await screen.findByText("Đã khóa tài khoản")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PUT")?.body).toEqual({ is_active: false });
  });

  it("temporarily locked (still active) user shows Mở khóa and PUTs is_active=true", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page([selfRow, makeUser({ is_locked: true })]),
      "PUT /api/users/2": { body: makeUser() },
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Mở khóa bien.tap" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mở khóa" }));
    expect(await screen.findByText("Đã mở khóa tài khoản")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PUT")?.body).toEqual({ is_active: true });
  });

  it("reset password shows the new temp password once", async () => {
    mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page(),
      "POST /api/users/2/reset-password": { body: { temp_password: "TamThoi12345" } },
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Đặt lại mật khẩu bien.tap" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đặt lại" }));
    expect(await screen.findByTestId("temp-password")).toHaveTextContent("TamThoi12345");
  });

  it("surfaces the server message when delete is refused (409)", async () => {
    mockApi({
      "GET /api/me": { body: admin },
      "GET /api/users": page(),
      "DELETE /api/users/2": {
        status: 409,
        body: errorBody("CONSTRAINT", "Tài khoản đã tạo dữ liệu, chỉ có thể khóa"),
      },
    });
    const user = userEvent.setup();
    renderApp("/users");
    await user.click(await screen.findByRole("button", { name: "Xóa bien.tap" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa" }));
    expect(
      await screen.findByText("Tài khoản đã tạo dữ liệu, chỉ có thể khóa"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
