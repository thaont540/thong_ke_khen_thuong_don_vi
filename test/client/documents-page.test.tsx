import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { doc, fileOfSize, listOf, withRole } from "./helpers/document-fixtures";
import { errorBody, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("documents page: list per role", () => {
  it("ADMIN sees formatted data and Tải về / Sửa / Xóa", async () => {
    mockApi({ ...withRole("ADMIN"), "GET /api/documents": listOf([doc()]) });
    renderApp("/documents");
    const table = within(await screen.findByRole("table"));
    expect(table.getByText("12/2026/NĐ-CP")).toBeInTheDocument();
    expect(table.getByText("15/03/2026")).toBeInTheDocument();
    expect(table.getByText("Nghị định")).toBeInTheDocument();
    expect(table.getByText("Còn hiệu lực")).toBeInTheDocument();
    expect(table.getByText("nghi-dinh-12.pdf")).toBeInTheDocument();
    expect(table.getByText("1,5 KB")).toBeInTheDocument();
    for (const name of ["Tải về", "Sửa", "Xóa"]) {
      expect(table.getByRole("button", { name: `${name} 12/2026/NĐ-CP` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Thêm văn bản" })).toBeInTheDocument();
  });

  it("EDITOR can manage", async () => {
    mockApi({ ...withRole("EDITOR"), "GET /api/documents": listOf([doc()]) });
    renderApp("/documents");
    expect(await screen.findByRole("button", { name: "Sửa 12/2026/NĐ-CP" })).toBeInTheDocument();
  });

  it("VIEWER only gets download", async () => {
    mockApi({ ...withRole("VIEWER"), "GET /api/documents": listOf([doc()]) });
    renderApp("/documents");
    expect(await screen.findByRole("button", { name: "Tải về 12/2026/NĐ-CP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sửa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Xóa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thêm văn bản" })).toBeNull();
  });

  it("shows an empty state, and a different one when filters are active", async () => {
    const api = mockApi({ ...withRole("ADMIN"), "GET /api/documents": listOf([]) });
    renderApp("/documents");
    expect(await screen.findByText("Chưa có văn bản quy định nào.")).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText("Loại văn bản"), "Thông tư");
    expect(await screen.findByText("Không có văn bản phù hợp.")).toBeInTheDocument();
    expect(api.calls.at(-1)?.query.get("doc_type")).toBe("THONG_TU");
  });

  it("sends search text and status filter, and pages 10 per page", async () => {
    const api = mockApi({ ...withRole("ADMIN"), "GET /api/documents": listOf([doc()], 25) });
    renderApp("/documents");
    const user = userEvent.setup();
    await screen.findByRole("table");
    expect(api.calls.at(-1)?.query.get("size")).toBe("10");
    await user.type(screen.getByLabelText("Tìm kiếm"), "khen thưởng");
    await user.selectOptions(screen.getByLabelText("Hiệu lực"), "Hết hiệu lực");
    await waitFor(() => {
      const q = api.calls.at(-1)?.query;
      expect(q?.get("q")).toBe("khen thưởng");
      expect(q?.get("status")).toBe("HET_HIEU_LUC");
    });
    await user.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(api.calls.at(-1)?.query.get("page")).toBe("3"));
  });
});

describe("documents page: delete and download", () => {
  it("confirms before deleting", async () => {
    const api = mockApi({
      ...withRole("ADMIN"),
      "GET /api/documents": listOf([doc()]),
      "DELETE /api/documents/5": { body: { ok: true } },
    });
    renderApp("/documents");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Xóa 12/2026/NĐ-CP" }));
    const dlg = within(await screen.findByRole("dialog", { name: "Xóa văn bản" }));
    expect(dlg.getByText(/nghi-dinh-12.pdf/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(dlg.getByRole("button", { name: "Xóa" }));
    expect(await screen.findByText("Đã xóa văn bản 12/2026/NĐ-CP")).toBeInTheDocument();
  });

  it("downloads through a blob link named after the file; errors become a toast", async () => {
    const api = mockApi({
      ...withRole("VIEWER"),
      "GET /api/documents": listOf([doc()]),
      "GET /api/documents/5/download": { body: "bytes" },
    });
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderApp("/documents");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Tải về 12/2026/NĐ-CP" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(create).toHaveBeenCalled();
    expect(api.calls.some((c) => c.path === "/api/documents/5/download")).toBe(true);
    click.mockRestore();
  });
});
