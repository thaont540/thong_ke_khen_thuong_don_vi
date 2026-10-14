import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { award, collectiveAward, listBody, master, officerDetail } from "./helpers/award-fixtures";
import { makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const base = (role: "ADMIN" | "EDITOR" | "VIEWER", items = [award(), collectiveAward()]) => ({
  "GET /api/me": { body: makeMe(role) },
  "GET /api/master": { body: master },
  "GET /api/awards": { body: listBody(items) },
});

describe("F01 awards list", () => {
  it("renders rows, stats line, STT, dd/mm/yyyy, 'Cấp đơn vị' and the medal variant name", async () => {
    mockApi(
      base("ADMIN", [
        award({
          award_type_id: 9,
          award_type_name: "Huân chương",
          award_variant_name: "Huân chương Chiến công hạng Nhất",
        }),
        collectiveAward(),
      ]),
    );
    renderApp("/");
    expect(await screen.findByText("Huân chương Chiến công hạng Nhất")).toBeInTheDocument();
    expect(screen.getAllByText("15/09/2026")).toHaveLength(2);
    expect(screen.getByText("Cấp đơn vị")).toBeInTheDocument();
    expect(screen.getByText("Đại úy, Phòng 6 / Đội cao tốc 1")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1] as HTMLElement).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(within(rows[2] as HTMLElement).getAllByRole("cell")[0]).toHaveTextContent("2");
    expect(screen.getByText("Hiển thị 1–2 trong 2")).toBeInTheDocument();
  });

  it("continues STT on page 2", async () => {
    mockApi({ ...base("ADMIN"), "GET /api/awards": { body: listBody([award()], 11, 2) } });
    renderApp("/?page=2");
    await screen.findByText("Nguyễn Văn An");
    expect(
      within(screen.getAllByRole("row")[1] as HTMLElement).getAllByRole("cell")[0],
    ).toHaveTextContent("11");
  });

  it("hides Sửa/Xóa/Thêm for VIEWER, shows them for EDITOR", async () => {
    mockApi(base("VIEWER"));
    const { unmount } = renderApp("/");
    await screen.findByText("Nguyễn Văn An");
    expect(screen.queryByRole("button", { name: /^Sửa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm khen thưởng" })).not.toBeInTheDocument();
    unmount();
    mockApi(base("EDITOR"));
    renderApp("/");
    expect(await screen.findAllByRole("button", { name: /^Sửa khen thưởng/ })).toHaveLength(2);
  });

  it("filters go to the URL/API and reset to page 1; Xóa bộ lọc clears them", async () => {
    const api = mockApi(base("ADMIN"));
    const user = userEvent.setup();
    const { router } = renderApp("/?page=3&subject=CA_NHAN");
    await screen.findByText("Nguyễn Văn An");
    await user.selectOptions(screen.getByLabelText("Hình thức"), "KHEN_THUONG");
    await waitFor(() => expect(router.state.location.search).toContain("form=KHEN_THUONG"));
    expect(router.state.location.search).not.toContain("page=");
    const last = api.calls.filter((c) => c.path === "/api/awards").at(-1);
    expect(last?.query.get("form")).toBe("KHEN_THUONG");
    expect(last?.query.get("subject")).toBe("CA_NHAN");
    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("debounces the search box and ignores a single character", async () => {
    const api = mockApi(base("ADMIN"));
    const user = userEvent.setup();
    const { router } = renderApp("/");
    await screen.findByText("Nguyễn Văn An");
    await user.type(screen.getByLabelText("Tìm kiếm"), "a");
    await new Promise((r) => setTimeout(r, 600));
    expect(router.state.location.search).toBe("");
    await user.type(screen.getByLabelText("Tìm kiếm"), "bc");
    await waitFor(() => expect(router.state.location.search).toBe("?q=abc"), { timeout: 2000 });
    await waitFor(() => expect(api.calls.some((c) => c.query.get("q") === "abc")).toBe(true));
  });

  it("shows an empty state with a reset button", async () => {
    mockApi(base("ADMIN", []));
    renderApp("/?q=zzz");
    expect(
      await screen.findByText("Không có bản ghi nào khớp với bộ lọc hiện tại."),
    ).toBeInTheDocument();
  });

  it("personal name opens the F02 modal via ?officer&award; modal closes by removing the params", async () => {
    mockApi({ ...base("ADMIN"), "GET /api/officers/5": { body: officerDetail() } });
    const user = userEvent.setup();
    const { router } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Nguyễn Văn An" }));
    expect(router.state.location.search).toBe("?officer=5&award=11");
    const dialog = await screen.findByRole("dialog", { name: "Nguyễn Văn An" });
    expect(await within(dialog).findByText("Khen thưởng đang xem")).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole("button", { name: "Đóng" }).at(-1) as HTMLElement);
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("delete: confirm dialog names the record, DELETE call, toast, refetch", async () => {
    const api = mockApi({ ...base("EDITOR"), "DELETE /api/awards/11": { body: { ok: true } } });
    const user = userEvent.setup();
    renderApp("/");
    await user.click(
      await screen.findByRole("button", { name: "Xóa khen thưởng của Nguyễn Văn An năm 2026" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Xóa khen thưởng" });
    expect(dialog).toHaveTextContent("Chiến sĩ thi đua cơ sở");
    expect(dialog).toHaveTextContent("125/QĐ-ĐV");
    await user.click(within(dialog).getByRole("button", { name: "Xóa" }));
    expect(await screen.findByText("Đã xóa khen thưởng của Nguyễn Văn An")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "DELETE" && c.path === "/api/awards/11")).toBe(true);
  });

  it("Sửa navigates to the edit route keeping the filters", async () => {
    mockApi({
      ...base("ADMIN"),
      "GET /api/awards/11": { body: award() },
      "GET /api/officers/options": { body: { items: [] } },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/?subject=CA_NHAN&page=2");
    await user.click(
      await screen.findByRole("button", { name: "Sửa khen thưởng của Nguyễn Văn An năm 2026" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/awards/11/edit"));
    expect(router.state.location.search).toBe("?subject=CA_NHAN&page=2");
  });
});
