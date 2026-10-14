import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { field, fillPersonal, setup } from "./helpers/award-form-test-helpers";
import { errorBody, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("F03 add form: submit and duplicates", () => {
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
