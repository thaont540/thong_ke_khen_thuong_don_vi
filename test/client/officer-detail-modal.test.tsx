import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { award, collectiveAward, listBody, master, officerDetail } from "./helpers/award-fixtures";
import { makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const open = (
  role: "ADMIN" | "EDITOR" | "VIEWER",
  detail = officerDetail(),
  path = "/?officer=5&award=11",
) => {
  mockApi({
    "GET /api/me": { body: makeMe(role) },
    "GET /api/master": { body: master },
    "GET /api/awards": { body: listBody([collectiveAward()]) },
    "GET /api/officers/5": { body: detail },
    "GET /api/officers/options": { body: { items: [] } },
  });
  return renderApp(path);
};

describe("F02 officer detail modal", () => {
  it("shows info, current award with dashes for N/A fields, and highlights it in history", async () => {
    const other = award({ id: 3, year: 2020, decision_number: "1/QĐ" });
    open("VIEWER", officerDetail([award(), other]));
    const dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    expect(await within(dialog).findByText("Đại úy, Cán bộ")).toBeInTheDocument();
    expect(within(dialog).getByText("CB005")).toBeInTheDocument();
    expect(within(dialog).getByText("Phòng 6 / Đội cao tốc 1")).toBeInTheDocument();
    // current award is a danh hieu: "Hình thức khen thưởng" is N/A
    expect(within(dialog).getByText("Hình thức khen thưởng").nextSibling).toHaveTextContent("—");
    const rows = within(dialog).getAllByRole("row");
    expect(rows[1]).toHaveClass("current");
    expect(rows[2]).not.toHaveClass("current");
    expect(within(dialog).getByText("1/QĐ, 15/09/2026")).toBeInTheDocument();
  });

  it("omits 'Khen thưởng đang xem' when opened without an award; shows empty history text", async () => {
    open("VIEWER", officerDetail([]), "/?officer=5");
    const dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    expect(
      await within(dialog).findByText("Cán bộ này chưa có khen thưởng nào."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Khen thưởng đang xem")).not.toBeInTheDocument();
  });

  it("buttons by role: VIEWER only Đóng, EDITOR + Thêm, ADMIN + Sửa thông tin", async () => {
    const { unmount } = open("VIEWER");
    let dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    await within(dialog).findByText("Thông tin cán bộ");
    expect(
      within(dialog).queryByRole("button", { name: "Thêm khen thưởng" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Sửa thông tin" })).not.toBeInTheDocument();
    unmount();
    const editor = open("EDITOR");
    dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    expect(
      await within(dialog).findByRole("button", { name: "Thêm khen thưởng" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Sửa thông tin" })).not.toBeInTheDocument();
    editor.unmount();
    open("ADMIN");
    dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    expect(
      await within(dialog).findByRole("button", { name: "Sửa thông tin" }),
    ).toBeInTheDocument();
  });

  it("Thêm khen thưởng goes to the prefilled add form; Sửa thông tin goes to /officers?edit", async () => {
    const user = userEvent.setup();
    const { router, unmount } = open("ADMIN");
    const dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    await user.click(await within(dialog).findByRole("button", { name: "Thêm khen thưởng" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/awards/new"));
    expect(router.state.location.search).toBe("?subject=CA_NHAN&officer=5&unit=6&team=1");
    expect(screen.queryByRole("dialog", { name: "Nguyễn Văn An" })).not.toBeInTheDocument();
    unmount();
    const second = open("ADMIN");
    const dialog2 = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    await user.click(await within(dialog2).findByRole("button", { name: "Sửa thông tin" }));
    await waitFor(() =>
      expect(second.router.state.location.pathname + second.router.state.location.search).toBe(
        "/officers?edit=5",
      ),
    );
  });

  it("closes with Esc and the × button", async () => {
    const user = userEvent.setup();
    const { router } = open("VIEWER");
    await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    await user.keyboard("{Escape}");
    expect(router.state.location.search).toBe("");
  });
});
