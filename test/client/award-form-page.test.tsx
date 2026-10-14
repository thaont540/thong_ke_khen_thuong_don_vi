import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { field, setup } from "./helpers/award-form-test-helpers";
import { renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("F03 add form", () => {
  it("defaults: Cá nhân, Danh hiệu, current year; officer locked until a unit is chosen", async () => {
    setup();
    renderApp("/awards/new");
    expect(await field(/Năm khen thưởng/)).toHaveValue(new Date().getFullYear());
    expect(screen.getByRole("radio", { name: "Cá nhân" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Danh hiệu" })).toBeChecked();
    expect(screen.getByLabelText(/Cán bộ/)).toBeDisabled();
    expect(screen.getByLabelText("Đội")).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Nhập thủ công" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("unit/team narrow the officer list; changing scope clears an out-of-scope officer", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    await user.selectOptions(await field(/Đơn vị/), "6");
    const officer = screen.getByLabelText(/Cán bộ/);
    expect(
      within(officer)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Chọn cán bộ", "Nguyễn Văn An (Đại úy, 123456)", "Trần Thị Bình (Đại úy, 654321)"]);
    await user.selectOptions(officer, "5");
    expect(await screen.findByText(/sinh 1990/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Đội"), "2"); // An is in team 1 -> cleared
    expect(officer).toHaveValue("");
    await user.selectOptions(officer, "6");
    await user.selectOptions(screen.getByLabelText(/Đơn vị/), "1"); // unit without teams
    expect(officer).toHaveValue("");
    expect(screen.getByLabelText("Đội")).toBeDisabled();
  });

  it("Tập thể hides the officer, relabels the team default; type list follows the matrix and is kept only if valid", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    const type = await field(/Danh hiệu thi đua/);
    expect(
      within(type)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Chọn danh hiệu", "Chiến sĩ thi đua cơ sở"]);
    await user.selectOptions(type, "7");
    await user.click(screen.getByRole("radio", { name: "Tập thể" }));
    expect(screen.queryByLabelText(/Cán bộ/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Danh hiệu thi đua/)).toHaveValue(""); // CSTD cơ sở invalid for Tập thể
    expect(
      within(screen.getByLabelText("Đội")).getByRole("option", { name: "Khen cho cả đơn vị" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Khen thưởng" }));
    await user.selectOptions(screen.getByLabelText(/Hình thức khen thưởng/), "12");
    await user.click(screen.getByRole("radio", { name: "Danh hiệu" }));
    await user.click(screen.getByRole("radio", { name: "Khen thưởng" }));
    expect(screen.getByLabelText(/Hình thức khen thưởng/)).toHaveValue(""); // cleared on form switch
    await user.selectOptions(screen.getByLabelText(/Hình thức khen thưởng/), "12");
    await user.click(screen.getByRole("radio", { name: "Cá nhân" }));
    expect(screen.getByLabelText(/Hình thức khen thưởng/)).toHaveValue("12"); // Giấy khen valid for both
  });

  it("medal variant field appears only for Huân chương; authority defaults from the type and stays editable", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    await user.click(await screen.findByRole("radio", { name: "Khen thưởng" }));
    const type = screen.getByLabelText(/Hình thức khen thưởng/);
    expect(screen.queryByLabelText(/Loại huân chương/)).not.toBeInTheDocument();
    await user.selectOptions(type, "9");
    expect(screen.getByLabelText(/Loại huân chương/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cấp quyết định/)).toHaveValue("1");
    await user.selectOptions(screen.getByLabelText(/Cấp quyết định/), "4");
    await user.selectOptions(type, "12");
    expect(screen.queryByLabelText(/Loại huân chương/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Cấp quyết định/)).toHaveValue("4"); // Giấy khen default
  });

  it("shows inline errors for all required fields and focuses the first invalid one", async () => {
    const api = setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    await user.click(await screen.findByRole("button", { name: "Lưu khen thưởng" }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
        "Chọn đơn vị",
        "Chọn cán bộ",
        "Chọn danh hiệu thi đua",
        "Nhập số quyết định",
        "Nhập ngày quyết định",
        "Chọn cấp quyết định",
        "Nhập thành tích, nội dung khen thưởng",
      ]),
    );
    await waitFor(() => expect(screen.getByLabelText(/Đơn vị/)).toHaveFocus());
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });
});
