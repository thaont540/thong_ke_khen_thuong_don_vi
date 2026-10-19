import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { doc, fileOfSize, listOf, withRole } from "./helpers/document-fixtures";
import { errorBody, mockApi, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

describe("documents page: form", () => {
  const open = async () => {
    const api = mockApi({
      ...withRole("ADMIN"),
      "GET /api/documents": listOf([]),
      "POST /api/documents": { status: 201, body: doc() },
    });
    renderApp("/documents");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Thêm văn bản" }));
    return { api, user, form: within(screen.getByRole("dialog", { name: "Thêm văn bản" })) };
  };

  it("validates required fields and the file before calling the API", async () => {
    const { api, user, form } = await open();
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Chọn loại văn bản")).toBeInTheDocument();
    expect(form.getAllByText("Bắt buộc nhập").length).toBeGreaterThan(0);
    expect(form.getByText("Chọn tệp văn bản")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("flags an impossible issue date (31/02) with the existing message", async () => {
    const { api, user, form } = await open();
    await user.type(form.getByLabelText(/Ngày ban hành/), "31/02/2026");
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText("Ngày ban hành không hợp lệ")).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("rejects files over 20 MB or of a wrong type on selection", async () => {
    const { user, form } = await open();
    const input = form.getByLabelText(/Tệp văn bản/);
    await user.upload(input, fileOfSize("lon.pdf", "application/pdf", 20 * 1024 * 1024 + 1));
    expect(await form.findByText("Tệp vượt quá 20 MB")).toBeInTheDocument();
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, fileOfSize("a.exe", "application/x-msdownload", 10));
    expect(await form.findByText(/Chỉ chấp nhận tệp PDF/)).toBeInTheDocument();
  });

  it("uploads metadata and the chosen file as multipart", async () => {
    const { api, user, form } = await open();
    await user.type(form.getByLabelText(/Số hiệu/), "12/2026/NĐ-CP");
    await user.selectOptions(form.getByLabelText(/Loại văn bản/), "Nghị định");
    await user.type(form.getByLabelText(/Trích yếu/), "  Quy định   về thi đua ");
    await user.type(form.getByLabelText(/Cơ quan ban hành/), "Chính phủ");
    await user.type(form.getByLabelText(/Ngày ban hành/), "15/03/2026");
    await user.upload(
      form.getByLabelText(/Tệp văn bản/),
      new File(["%PDF-1"], "nd12.pdf", { type: "application/pdf" }),
    );
    expect(form.getByText(/Đã chọn: nd12.pdf/)).toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Đã lưu văn bản")).toBeInTheDocument();
    const body = api.calls.find((c) => c.method === "POST")?.body as FormData;
    expect(body.get("doc_number")).toBe("12/2026/NĐ-CP");
    expect(body.get("doc_type")).toBe("NGHI_DINH");
    expect(body.get("title")).toBe("Quy định về thi đua");
    expect(body.get("issued_date")).toBe("2026-03-15");
    expect(body.get("status")).toBe("CON_HIEU_LUC");
    expect((body.get("file") as File).name).toBe("nd12.pdf");
  });

  it("edit sends a PUT without a file part unless a new one is chosen", async () => {
    const api = mockApi({
      ...withRole("EDITOR"),
      "GET /api/documents": listOf([doc()]),
      "PUT /api/documents/5": { body: doc({ title: "Mới" }) },
    });
    renderApp("/documents");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Sửa 12/2026/NĐ-CP" }));
    const form = within(screen.getByRole("dialog", { name: "Sửa văn bản" }));
    expect(form.getByText(/Tệp hiện tại: nghi-dinh-12.pdf/)).toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Lưu" }));
    await screen.findByText("Đã lưu văn bản");
    const body = api.calls.find((c) => c.method === "PUT")?.body as FormData;
    expect(body.has("file")).toBe(false);
    expect(body.get("title")).toBe("Quy định về thi đua, khen thưởng");
  });

  it("shows a server file error on the file field", async () => {
    const message = "Nội dung tệp không đúng định dạng";
    const api = mockApi({
      ...withRole("ADMIN"),
      "GET /api/documents": listOf([]),
      "POST /api/documents": {
        status: 400,
        body: errorBody("VALIDATION", message, { file: message }),
      },
    });
    renderApp("/documents");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Thêm văn bản" }));
    const form = within(screen.getByRole("dialog", { name: "Thêm văn bản" }));
    await user.type(form.getByLabelText(/Số hiệu/), "1");
    await user.selectOptions(form.getByLabelText(/Loại văn bản/), "Luật");
    await user.type(form.getByLabelText(/Trích yếu/), "t");
    await user.type(form.getByLabelText(/Cơ quan ban hành/), "c");
    await user.type(form.getByLabelText(/Ngày ban hành/), "02/01/2026");
    await user.upload(
      form.getByLabelText(/Tệp văn bản/),
      new File(["%PDF-1"], "a.pdf", { type: "application/pdf" }),
    );
    await user.click(form.getByRole("button", { name: "Lưu" }));
    expect(await form.findByText(message)).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(true);
  });
});
