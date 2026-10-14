import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MasterDataDto } from "../../src/shared/schemas/master-data-dto";
import type { OfficerListItem } from "../../src/shared/schemas/officer-schemas";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const admin = makeMe("ADMIN");
const master: MasterDataDto = {
  units: [
    {
      id: 1,
      code: "P1",
      name: "Phòng 1",
      kind: "PHONG",
      description: null,
      sort_order: 1,
      teams: [{ id: 11, unit_id: 1, code: "P1-T1", name: "Đội một", sort_order: 1 }],
    },
    {
      id: 2,
      code: "P2",
      name: "Phòng 2",
      kind: "PHONG",
      description: null,
      sort_order: 2,
      teams: [],
    },
  ],
  ranks: [{ id: 3, code: "R3", name: "Đại úy", rank_group: "CAP_UY", sort_order: 1 }],
  positions: [{ id: 4, code: "P4", name: "Cán bộ", level: "CAN_BO", sort_order: 1 }],
  authorities: [],
  award_types: [],
  award_variants: [],
};
const officer = (over: Partial<OfficerListItem> = {}): OfficerListItem => ({
  id: 7,
  code: "CB007",
  full_name: "Nguyễn Văn An",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: 3,
  position_id: 4,
  unit_id: 1,
  team_id: 11,
  award_count: 3,
  ...over,
});
const page = (items: OfficerListItem[]) => ({
  body: { items, total: items.length, page: 1, size: 10 },
});
const base = (items = [officer()]) => ({
  "GET /api/me": { body: admin },
  "GET /api/master": { body: master },
  "GET /api/officers": page(items),
});

describe("F05 officers page", () => {
  it("renders names for rank, position, unit and team; view link sets ?officer", async () => {
    mockApi(base());
    const user = userEvent.setup();
    const { router } = renderApp("/officers");
    expect(await screen.findByText("Đại úy")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Đội một")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Xem Nguyễn Văn An" }));
    expect(router.state.location.search).toBe("?officer=7");
  });

  it("delete dialog shows name, badge and award count, then deletes", async () => {
    const api = mockApi({
      ...base(),
      "DELETE /api/officers/7": { body: { ok: true, deleted_awards: 3 } },
    });
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Xóa Nguyễn Văn An" }));
    const dlg = within(await screen.findByRole("dialog", { name: "Xóa cán bộ" }));
    expect(dlg.getByText(/Nguyễn Văn An \(số hiệu 123456\)\? 3 khen thưởng/)).toBeInTheDocument();
    await user.click(dlg.getByRole("button", { name: "Xóa" }));
    expect(
      await screen.findByText(/Đã xóa cán bộ Nguyễn Văn An và 3 khen thưởng/),
    ).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("BR-03: team select is locked for a unit without teams and has the 'Không thuộc đội' option", async () => {
    mockApi(base());
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Thêm cán bộ" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm cán bộ" }));
    expect(form.getByLabelText(/Mã cán bộ/)).toHaveAttribute("readonly");
    expect(form.getByLabelText("Đội")).toBeDisabled();
    await user.selectOptions(form.getByLabelText(/Đơn vị/), "Phòng 1");
    const team = form.getByLabelText("Đội");
    expect(team).toBeEnabled();
    expect(within(team).getByRole("option", { name: "Không thuộc đội" })).toBeInTheDocument();
    await user.selectOptions(form.getByLabelText(/Đơn vị/), "Phòng 2");
    expect(form.getByLabelText("Đội")).toBeDisabled();
  });

  it("creates an officer with numeric ids and maps a duplicate badge onto the field", async () => {
    const api = mockApi({
      ...base(),
      "POST /api/officers": {
        status: 409,
        body: errorBody("CONFLICT", "Số hiệu đã tồn tại", { badge_number: "Số hiệu đã tồn tại" }),
      },
    });
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Thêm cán bộ" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm cán bộ" }));
    await user.type(form.getByLabelText(/Họ tên/), "  Trần  Bình ");
    await user.type(form.getByLabelText(/Năm sinh/), "1985");
    await user.type(form.getByLabelText(/Số hiệu/), "654321");
    await user.selectOptions(form.getByLabelText(/Cấp bậc/), "Đại úy");
    await user.selectOptions(form.getByLabelText(/Chức vụ/), "Cán bộ");
    await user.selectOptions(form.getByLabelText(/Đơn vị/), "Phòng 1");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Số hiệu đã tồn tại")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "POST")?.body).toEqual({
      full_name: "Trần Bình",
      birth_year: 1985,
      badge_number: "654321",
      rank_id: 3,
      position_id: 4,
      unit_id: 1,
      team_id: null,
    });
  });

  it("validates required fields locally without calling the API", async () => {
    const api = mockApi(base());
    const user = userEvent.setup();
    renderApp("/officers");
    await user.click(await screen.findByRole("button", { name: "Thêm cán bộ" }));
    const form = within(screen.getByRole("dialog"));
    await user.type(form.getByLabelText(/Số hiệu/), "123");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Số hiệu gồm đúng 6 chữ số")).toBeInTheDocument();
    expect(form.getByText("Nhập họ tên")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("?edit=<id> opens the edit modal prefilled (from F02 'Sửa thông tin')", async () => {
    const detail = { ...officer(), awards: [] };
    mockApi({ ...base([]), "GET /api/officers/7": { body: detail } });
    const { router } = renderApp("/officers?edit=7");
    const form = within(await screen.findByRole("dialog", { name: "Sửa cán bộ" }));
    expect(form.getByLabelText(/Họ tên/)).toHaveValue("Nguyễn Văn An");
    expect(form.getByLabelText(/Mã cán bộ/)).toHaveValue("CB007");
    await userEvent.setup().click(form.getAllByRole("button", { name: "Hủy" })[0] as HTMLElement);
    expect(router.state.location.search).toBe("");
  });
});
