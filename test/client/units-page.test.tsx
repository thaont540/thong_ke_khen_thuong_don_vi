import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UnitDetail, UnitListItem } from "../../src/shared/schemas/unit-schemas";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const admin = makeMe("ADMIN");
const row = (over: Partial<UnitListItem> = {}): UnitListItem => ({
  id: 1,
  code: "P1",
  name: "Phòng 1",
  kind: "PHONG",
  description: "Phòng tham mưu",
  team_count: 1,
  officer_count: 0,
  award_count: 0,
  ...over,
});
const detail = (over: Partial<UnitDetail> = {}): UnitDetail => ({
  ...row(),
  teams: [{ id: 5, code: "P1-T1", name: "Đội một", officer_count: 2, award_count: 3 }],
  ...over,
});
const page = (items: UnitListItem[]) => ({
  body: { items, total: items.length, page: 1, size: 10 },
});

describe("F06 units page", () => {
  it("lists units with counts and opens the view modal with teams", async () => {
    mockApi({
      "GET /api/me": { body: admin },
      "GET /api/units": page([row()]),
      "GET /api/units/1": { body: detail() },
    });
    const user = userEvent.setup();
    renderApp("/units");
    expect(await screen.findByText("Phòng tham mưu")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xem Phòng 1" }));
    const dlg = within(await screen.findByRole("dialog", { name: "Phòng 1" }));
    expect(await dlg.findByText("Đội một")).toBeInTheDocument();
    expect(dlg.getByRole("button", { name: "Sửa đơn vị" })).toBeInTheDocument();
  });

  it("blocks delete client-side with counts when the unit is used", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/units": page([row({ officer_count: 2, award_count: 4 })]),
    });
    const user = userEvent.setup();
    renderApp("/units");
    await user.click(await screen.findByRole("button", { name: "Xóa Phòng 1" }));
    const dlg = await screen.findByRole("dialog", { name: "Chưa thể xóa đơn vị" });
    expect(dlg).toHaveTextContent("2 cán bộ và 4 khen thưởng");
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("confirms and deletes an empty unit", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/units": page([row()]),
      "DELETE /api/units/1": { body: { ok: true } },
    });
    const user = userEvent.setup();
    renderApp("/units");
    await user.click(await screen.findByRole("button", { name: "Xóa Phòng 1" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Xóa" }),
    );
    expect(await screen.findByText("Đã xóa đơn vị")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "DELETE" && c.path === "/api/units/1")).toBe(true);
  });

  it("edits teams inline: rename keeps id, new row has none, removed row is omitted", async () => {
    const api = mockApi({
      "GET /api/me": { body: admin },
      "GET /api/units": page([row()]),
      "GET /api/units/1": { body: detail() },
      "PUT /api/units/1": { body: detail() },
    });
    const user = userEvent.setup();
    renderApp("/units");
    await user.click(await screen.findByRole("button", { name: "Sửa Phòng 1" }));
    const form = within(await screen.findByRole("dialog", { name: "Sửa đơn vị" }));
    const first = await form.findByLabelText("Tên đội 1");
    await user.clear(first);
    await user.type(first, "Đội đổi tên");
    await user.click(form.getByRole("button", { name: "Thêm đội" }));
    await user.type(form.getByLabelText("Tên đội 2"), "Đội mới");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    await screen.findByText("Đã lưu đơn vị");
    expect(api.calls.find((c) => c.method === "PUT")?.body).toMatchObject({
      code: "P1",
      teams: [{ id: 5, name: "Đội đổi tên" }, { name: "Đội mới" }],
    });
  });

  it("rejects an empty team name locally and maps server duplicate errors onto the row", async () => {
    mockApi({
      "GET /api/me": { body: admin },
      "GET /api/units": page([row()]),
      "POST /api/units": {
        status: 409,
        body: errorBody("CONFLICT", "Tên đội bị trùng trong đơn vị", {
          "teams.0": "Tên đội bị trùng trong đơn vị",
        }),
      },
    });
    const user = userEvent.setup();
    renderApp("/units");
    await user.click(await screen.findByRole("button", { name: "Thêm đơn vị" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm đơn vị" }));
    await user.type(form.getByLabelText(/Mã đơn vị/), "X1");
    await user.type(form.getByLabelText(/Tên đơn vị/), "Đơn vị X");
    await user.click(form.getByRole("button", { name: "Thêm đội" }));
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Nhập tên đội")).toBeInTheDocument();
    await user.type(form.getByLabelText("Tên đội 1"), "Đội A");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Tên đội bị trùng trong đơn vị")).toBeInTheDocument();
  });
});
