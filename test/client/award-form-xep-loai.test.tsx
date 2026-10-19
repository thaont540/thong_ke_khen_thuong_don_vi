import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { award, listBody } from "./helpers/award-fixtures";
import { field, setup } from "./helpers/award-form-test-helpers";
import { renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("F03 'Xếp loại cán bộ' form", () => {
  it("is offered for Cá nhân only; selecting it relabels the select and fills the default authority", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    const xepLoai = await screen.findByRole("radio", { name: "Xếp loại cán bộ" });
    await user.click(xepLoai);
    const type = screen.getByRole("combobox", { name: /^Xếp loại/ });
    expect(
      within(type)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Chọn xếp loại", "Hoàn thành xuất sắc nhiệm vụ"]);
    await user.selectOptions(type, "13");
    expect(screen.getByLabelText(/Cấp quyết định/)).toHaveValue("4");

    // Switching to Tập thể drops the individual-only form back to Danh hiệu.
    await user.click(screen.getByRole("radio", { name: "Tập thể" }));
    expect(screen.queryByRole("radio", { name: "Xếp loại cán bộ" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Danh hiệu" })).toBeChecked();
    expect(await field(/Danh hiệu thi đua/)).toHaveValue("");
  });
});

describe("F01 'Xếp loại cán bộ' list support", () => {
  it("filter option sends form=XEP_LOAI, stats line shows the rating count, rows show the label", async () => {
    const rating = award({ id: 9, form: "XEP_LOAI", award_type_name: "Hoàn thành tốt nhiệm vụ" });
    const api = setup({
      "GET /api/awards": {
        body: { ...listBody([rating]), stats: { ...listBody([rating]).stats, xep_loai: 1 } },
      },
    });
    const user = userEvent.setup();
    renderApp("/awards");
    expect(await screen.findByText("xếp loại")).toBeInTheDocument();
    expect(screen.getAllByText("Xếp loại cán bộ").length).toBeGreaterThanOrEqual(2); // option + badge
    await user.selectOptions(screen.getByLabelText("Hình thức"), "Xếp loại cán bộ");
    await vi.waitFor(() =>
      expect(api.calls.some((c) => c.query.get("form") === "XEP_LOAI")).toBe(true),
    );
  });
});
