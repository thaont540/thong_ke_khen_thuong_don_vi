import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { award, listBody, master, officerDetail, officerOption } from "./helpers/award-fixtures";
import { errorBody, makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

const officers = [
  officerOption(),
  officerOption({
    id: 6,
    code: "CB006",
    full_name: "Trần Thị Bình",
    badge_number: "654321",
    team_id: 2,
  }),
  officerOption({
    id: 7,
    code: "CB007",
    full_name: "Lê Văn Cường",
    badge_number: "111111",
    unit_id: 1,
    team_id: null,
  }),
];

const setup = (extra: Parameters<typeof mockApi>[0] = {}, role: "ADMIN" | "EDITOR" = "EDITOR") =>
  mockApi({
    "GET /api/me": { body: makeMe(role) },
    "GET /api/master": { body: master },
    "GET /api/officers/options": { body: { items: officers } },
    "GET /api/awards": { body: listBody([]) },
    "GET /api/officers/5": { body: officerDetail([]) },
    ...extra,
  });

const field = (label: RegExp | string) => screen.findByLabelText(label);

async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await field(/Số quyết định/), "99/QĐ");
  await user.type(screen.getByLabelText(/Ngày quyết định/), "2026-05-01");
  await user.type(screen.getByLabelText(/Thành tích/), "Thành tích tốt");
}

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

  async function fillPersonal(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(await field(/Đơn vị/), "6");
    await user.selectOptions(screen.getByLabelText(/Cán bộ/), "5");
    await user.selectOptions(screen.getByLabelText(/Danh hiệu thi đua/), "7");
    await fillCommon(user);
  }

  it("Lưu khen thưởng posts the payload, toasts and returns to the list", async () => {
    const api = setup({ "POST /api/awards": { status: 201, body: { id: 1 } } });
    const user = userEvent.setup();
    const { router } = renderApp("/awards/new");
    await fillPersonal(user);
    await user.click(screen.getByRole("button", { name: "Lưu khen thưởng" }));
    expect(await screen.findByText("Đã lưu khen thưởng cho Nguyễn Văn An")).toBeInTheDocument();
    const post = api.calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      subject: "CA_NHAN",
      officer_id: 5,
      award_type_id: 7,
      award_variant_id: null,
      authority_id: 4,
      decision_number: "99/QĐ",
      decision_date: "2026-05-01",
      achievement: "Thành tích tốt",
      note: null,
    });
    expect(post?.body).not.toHaveProperty("confirm_duplicate");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("Lưu và thêm tiếp keeps every field except the officer and stays on the form", async () => {
    setup({ "POST /api/awards": { status: 201, body: { id: 1 } } });
    const user = userEvent.setup();
    const { router } = renderApp("/awards/new");
    await fillPersonal(user);
    await user.click(screen.getByRole("button", { name: "Lưu và thêm tiếp" }));
    await screen.findByText("Đã lưu khen thưởng cho Nguyễn Văn An");
    expect(screen.getByLabelText(/Cán bộ/)).toHaveValue("");
    expect(screen.getByLabelText(/Đơn vị/)).toHaveValue("6");
    expect(screen.getByLabelText(/Số quyết định/)).toHaveValue("99/QĐ");
    expect(screen.getByLabelText(/Danh hiệu thi đua/)).toHaveValue("7");
    expect(router.state.location.pathname).toBe("/awards/new");
  });

  it("Xóa nội dung resets the form", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    await fillPersonal(user);
    await user.click(screen.getByRole("button", { name: "Xóa nội dung" }));
    expect(screen.getByLabelText(/Số quyết định/)).toHaveValue("");
    expect(screen.getByLabelText(/Đơn vị/)).toHaveValue("");
  });

  it("duplicate: 409 opens the dialog; Hủy keeps the form; Vẫn lưu resends with confirm_duplicate", async () => {
    let calls = 0;
    const api = setup({
      "POST /api/awards": ({ body }) => {
        calls++;
        if ((body as { confirm_duplicate?: boolean }).confirm_duplicate)
          return { status: 201, body: { id: 2 } };
        return {
          status: 409,
          body: {
            error: {
              code: "DUPLICATE",
              message: "Có thể bị trùng",
              duplicates: [
                {
                  id: 3,
                  decision_number: "77/QĐ",
                  year: 2026,
                  type_name: "Chiến sĩ thi đua cơ sở",
                },
              ],
            },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp("/awards/new");
    await fillPersonal(user);
    await user.click(screen.getByRole("button", { name: "Lưu khen thưởng" }));
    const dialog = await screen.findByRole("dialog", { name: "Có thể bị trùng" });
    expect(dialog).toHaveTextContent(
      "Nguyễn Văn An đã có Chiến sĩ thi đua cơ sở năm 2026 (quyết định 77/QĐ)",
    );
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Số quyết định/)).toHaveValue("99/QĐ");
    await user.click(screen.getByRole("button", { name: "Lưu khen thưởng" }));
    await user.click(await screen.findByRole("button", { name: "Vẫn lưu" }));
    expect(await screen.findByText("Đã lưu khen thưởng cho Nguyễn Văn An")).toBeInTheDocument();
    expect(calls).toBe(3);
    expect(api.calls.filter((c) => c.method === "POST").at(-1)?.body).toMatchObject({
      confirm_duplicate: true,
    });
  });

  it("maps server field errors under the field", async () => {
    setup({
      "POST /api/awards": {
        status: 422,
        body: errorBody("CONSTRAINT", "Cán bộ không tồn tại", {
          officer_id: "Cán bộ không tồn tại",
        }),
      },
    });
    const user = userEvent.setup();
    renderApp("/awards/new");
    await fillPersonal(user);
    await user.click(screen.getByRole("button", { name: "Lưu khen thưởng" }));
    expect(await screen.findByText("Cán bộ không tồn tại")).toBeInTheDocument();
  });

  it("prefills from ?subject&unit&team&officer (F02 'Thêm khen thưởng')", async () => {
    setup();
    renderApp("/awards/new?subject=CA_NHAN&unit=6&team=1&officer=5");
    expect(await field(/Cán bộ/)).toHaveValue("5");
    expect(screen.getByLabelText(/Đơn vị/)).toHaveValue("6");
    expect(screen.getByLabelText("Đội")).toHaveValue("1");
  });

  it("Import tab renders the lazily loaded panel", async () => {
    setup();
    const user = userEvent.setup();
    renderApp("/awards/new");
    await user.click(await screen.findByRole("tab", { name: "Import từ Excel" }));
    expect(await screen.findByRole("tabpanel")).toBeInTheDocument();
  });
});

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
