import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { award } from "./helpers/award-fixtures";
import { field, setup } from "./helpers/award-form-test-helpers";
import { errorBody, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("F09 edit form", () => {
  const edit = (extra: Parameters<typeof mockApi>[0] = {}) =>
    setup({ "GET /api/awards/11": { body: award() }, ...extra });

  it("shows the banner and title, prefilled values, and hides import tab / extra buttons", async () => {
    edit();
    renderApp("/awards/11/edit?subject=CA_NHAN&page=2");
    expect(await screen.findByRole("heading", { name: "Sửa khen thưởng" })).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Đang sửa bản ghi 125\/QĐ-ĐV: Chiến sĩ thi đua cơ sở năm 2026 của Nguyễn Văn An/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Số quyết định/)).toHaveValue("125/QĐ-ĐV");
    expect(screen.getByLabelText(/Cán bộ/)).toHaveValue("5");
    expect(screen.getByLabelText(/Cấp quyết định/)).toHaveValue("4");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    for (const name of ["Lưu và thêm tiếp", "Xóa nội dung", "Lưu khen thưởng"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
  });

  it("Lưu thay đổi PUTs, toasts and returns to the list with the same filters", async () => {
    const api = edit({ "PUT /api/awards/11": { body: { id: 11 } } });
    const user = userEvent.setup();
    const { router } = renderApp("/awards/11/edit?subject=CA_NHAN&page=2");
    const achievement = await field(/Thành tích/);
    await user.clear(achievement);
    await user.type(achievement, "Đã sửa");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(
      await screen.findByText("Đã cập nhật khen thưởng của Nguyễn Văn An"),
    ).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PUT")?.body).toMatchObject({
      achievement: "Đã sửa",
      officer_id: 5,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.search).toBe("?subject=CA_NHAN&page=2");
  });

  it("keeps the stored officer selectable even when the officer left the unit scope; Hủy returns without saving", async () => {
    const api = edit();
    const user = userEvent.setup();
    const { router } = renderApp("/awards/11/edit?unit_id=6");
    await field(/Cán bộ/);
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.search).toBe("?unit_id=6");
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("404 record shows the error with a way back", async () => {
    setup({
      "GET /api/awards/99": {
        status: 404,
        body: errorBody("NOT_FOUND", "Không tìm thấy bản ghi khen thưởng"),
      },
    });
    renderApp("/awards/99/edit");
    expect(await screen.findByText("Không tìm thấy bản ghi khen thưởng")).toBeInTheDocument();
  });
});
