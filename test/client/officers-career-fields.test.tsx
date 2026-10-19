import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { base, officer } from "./helpers/officers-page-fixtures";
import { mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("F05 officers page: month joined, seniority, derived rating, optional fields", () => {
  it("sends joined_month when filled (no rating field), and rejects a future month locally", async () => {
    const api = mockApi({ ...base(), "POST /api/officers": { status: 201, body: officer() } });
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Thêm cán bộ" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm cán bộ" }));
    await user.type(form.getByLabelText(/Họ tên/), "Trần Bình");
    await user.type(form.getByLabelText(/Năm sinh/), "1985");
    await user.type(form.getByLabelText(/Số hiệu/), "654321");
    await user.selectOptions(form.getByLabelText(/Cấp bậc/), "Đại úy");
    await user.selectOptions(form.getByLabelText(/Chức vụ/), "Cán bộ");
    await user.selectOptions(form.getByLabelText(/Đơn vị/), "Phòng 1");
    expect(form.queryByLabelText("Xếp loại")).not.toBeInTheDocument();
    fireEvent.change(form.getByLabelText("Tháng năm vào ngành"), { target: { value: "01/2999" } });
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Tháng năm vào ngành không được ở tương lai")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(form.getByLabelText("Tháng năm vào ngành"), { target: { value: "05/2010" } });
    await user.click(form.getByRole("button", { name: "Lưu" }));
    await vi.waitFor(() => expect(api.calls.some((c) => c.method === "POST")).toBe(true));
    expect(api.calls.find((c) => c.method === "POST")?.body).toMatchObject({
      joined_month: "2010-05",
      birth_year: 1985,
      badge_number: "654321",
    });
    expect(api.calls.find((c) => c.method === "POST")?.body).not.toHaveProperty("rating_id");
  });

  it("birth year and badge are optional: left empty they are sent as null", async () => {
    const api = mockApi({ ...base(), "POST /api/officers": { status: 201, body: officer() } });
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Thêm cán bộ" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm cán bộ" }));
    await user.type(form.getByLabelText(/Họ tên/), "Trần Bình");
    await user.selectOptions(form.getByLabelText(/Cấp bậc/), "Đại úy");
    await user.selectOptions(form.getByLabelText(/Chức vụ/), "Cán bộ");
    await user.selectOptions(form.getByLabelText(/Đơn vị/), "Phòng 1");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    await vi.waitFor(() => expect(api.calls.some((c) => c.method === "POST")).toBe(true));
    expect(api.calls.find((c) => c.method === "POST")?.body).toMatchObject({
      birth_year: null,
      badge_number: null,
    });
  });

  it("table shows joined month, seniority and rating, with dashes when empty", async () => {
    const year = new Date().getFullYear();
    mockApi(
      base([
        officer({
          joined_month: `${year - 5}-03`,
          current_rating: { name: "Hoàn thành xuất sắc nhiệm vụ", year: 2025 },
        }),
        officer({
          id: 8,
          code: "CB008",
          full_name: "Lê Cường",
          badge_number: null,
          birth_year: null,
        }),
      ]),
    );
    renderApp("/officers");
    const table = within(await screen.findByRole("table"));
    expect(await table.findByText(`03/${year - 5}`)).toBeInTheDocument();
    expect(table.getByText("5 năm")).toBeInTheDocument();
    expect(table.getByText("Hoàn thành xuất sắc nhiệm vụ (2025)")).toBeInTheDocument();
    const emptyRow = table.getByText("Lê Cường").closest("tr") as HTMLElement;
    expect(within(emptyRow).getAllByText("—").length).toBeGreaterThanOrEqual(5);
  });
});
