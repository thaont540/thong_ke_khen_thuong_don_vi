import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const meApi = { "GET /api/me": { body: makeMe("VIEWER") } };

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  cur: string,
  next: string,
  again: string,
) {
  await user.type(await screen.findByLabelText(/Mật khẩu hiện tại/), cur);
  await user.type(screen.getByLabelText(/^Mật khẩu mới/), next);
  await user.type(screen.getByLabelText(/Nhập lại/), again);
  await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
}

describe("change password", () => {
  it("rejects a new password shorter than 10 characters", async () => {
    const api = mockApi(meApi);
    renderApp("/change-password");
    await submit(userEvent.setup(), "cu-mat-khau-1", "ngan", "ngan");
    expect(await screen.findByText("Mật khẩu mới tối thiểu 10 ký tự")).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "/api/auth/change-password")).toBe(false);
  });

  it("rejects a new password equal to the old one", async () => {
    mockApi(meApi);
    renderApp("/change-password");
    await submit(userEvent.setup(), "mat-khau-cu-123", "mat-khau-cu-123", "mat-khau-cu-123");
    expect(await screen.findByText("Mật khẩu mới phải khác mật khẩu cũ")).toBeInTheDocument();
  });

  it("rejects mismatched confirmation", async () => {
    mockApi(meApi);
    renderApp("/change-password");
    await submit(userEvent.setup(), "mat-khau-cu-123", "mat-khau-moi-456", "mat-khau-moi-457");
    expect(await screen.findByText("Hai ô mật khẩu không khớp")).toBeInTheDocument();
  });

  it("maps a server field error to the field (wrong current password)", async () => {
    mockApi({
      ...meApi,
      "POST /api/auth/change-password": {
        status: 400,
        body: errorBody("VALIDATION", "Mật khẩu hiện tại không đúng", {
          current_password: "Mật khẩu hiện tại không đúng",
        }),
      },
    });
    const { router } = renderApp("/change-password");
    await submit(userEvent.setup(), "sai-mat-khau-1", "mat-khau-moi-456", "mat-khau-moi-456");
    expect(await screen.findByText("Mật khẩu hiện tại không đúng")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/change-password");
  });

  it("succeeds, refreshes the session and lands on /", async () => {
    let changed = false;
    const api = mockApi({
      "GET /api/me": () => ({ body: makeMe("EDITOR", { must_change_password: !changed }) }),
      "POST /api/auth/change-password": () => {
        changed = true;
        return { body: { ok: true } };
      },
    });
    const { router } = renderApp("/change-password");
    await submit(userEvent.setup(), "tam-thoi-12345", "mat-khau-moi-456", "mat-khau-moi-456");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(api.calls.find((c) => c.path === "/api/auth/change-password")?.body).toEqual({
      current_password: "tam-thoi-12345",
      new_password: "mat-khau-moi-456",
      confirm_password: "mat-khau-moi-456",
    });
  });
});
