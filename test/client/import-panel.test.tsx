import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportRow } from "../../src/shared/schemas/award-import-schemas";
import { listBody, master, officerOption } from "./helpers/award-fixtures";
import { HEADERS, sheetRow, xlsxFile } from "./helpers/import-file-builders";
import { makeMe, mockApi, type RecordedCall, renderApp } from "./helpers/render-with-providers";

afterEach(() => vi.unstubAllGlobals());

interface LotBody {
  dry_run?: boolean;
  batch_id?: number;
  include_duplicates?: boolean;
  client_error_rows?: number;
  total_rows: number;
  rows: ImportRow[];
}

/** Dry run: every row OK except `dupRows` (DB duplicates). Commit: saves all rows, batch id 77. */
function importHandler(opts: { dupRows?: number[]; failLot?: number } = {}) {
  let commits = 0;
  return ({ body }: { body: unknown }) => {
    const b = body as LotBody;
    const results = b.rows.map((r) => {
      const dup = opts.dupRows?.includes(r.row_number) ?? false;
      return {
        row_number: r.row_number,
        status: dup ? "DUPLICATE" : "OK",
        errors: [],
        duplicate_messages: dup ? ["Trùng với bản ghi đã có (quyết định 77/QĐ-A)"] : [],
        imported: !b.dry_run && (!dup || b.include_duplicates === true),
      };
    });
    if (b.dry_run) return { body: { batch_id: null, imported_count: 0, results } };
    commits += 1;
    if (opts.failLot === commits) {
      return { status: 500, body: { error: { code: "INTERNAL", message: "Lỗi máy chủ" } } };
    }
    return {
      body: { batch_id: 77, imported_count: results.filter((r) => r.imported).length, results },
    };
  };
}

const setup = (importReply: ReturnType<typeof importHandler>) =>
  mockApi({
    "GET /api/me": { body: makeMe("EDITOR") },
    "GET /api/master": { body: master },
    "GET /api/officers/options": { body: { items: [officerOption()] } },
    "GET /api/awards": { body: listBody([]) },
    "POST /api/awards/import": importReply,
  });

async function openImportTab() {
  const user = userEvent.setup();
  renderApp("/awards/new");
  await user.click(await screen.findByRole("tab", { name: "Import từ Excel" }));
  return user;
}

const upload = async (user: ReturnType<typeof userEvent.setup>, file: File) =>
  user.upload(await screen.findByLabelText("Chọn file import"), file);

const lots = (calls: RecordedCall[], dry: boolean) =>
  calls
    .filter((c) => c.method === "POST" && c.path === "/api/awards/import")
    .map((c) => c.body as LotBody)
    .filter((b) => (b.dry_run === true) === dry);

describe("F04 import panel", () => {
  it("shows the preview with statuses and exact messages; button counts valid rows", async () => {
    const { calls } = setup(importHandler());
    const user = await openImportTab();
    await upload(
      user,
      xlsxFile([
        HEADERS,
        sheetRow(),
        sheetRow({ "Đơn vị": "Phòng 99", Năm: 2025 }),
        sheetRow({ "Ngày quyết định": "31/02/2026", Năm: 2024 }),
      ]),
    );
    expect(await screen.findByText(/3 dòng/)).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0] as HTMLElement).getByText("Hợp lệ")).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText('Không tìm thấy đơn vị "Phòng 99"'),
    ).toBeInTheDocument();
    expect(
      within(rows[2] as HTMLElement).getByText("Ngày quyết định phải theo dạng dd/mm/yyyy"),
    ).toBeInTheDocument();
    expect(rows[1]).toHaveClass("row-err");
    expect(screen.getByRole("button", { name: "Nhập 1 dòng hợp lệ" })).toBeEnabled();
    // Only locally valid rows go to the dry run.
    expect(lots(calls, true).flatMap((b) => b.rows.map((r) => r.row_number))).toEqual([2]);
  });

  it("flags file duplicates (local) and DB duplicates (server); checkbox adds them to the count", async () => {
    const { calls } = setup(importHandler({ dupRows: [4] }));
    const user = await openImportTab();
    await upload(
      user,
      xlsxFile([
        HEADERS,
        sheetRow(),
        sheetRow({ "Số quyết định": "2/QĐ" }), // same officer/type/year as row 2
        sheetRow({ Năm: 2025 }), // DB duplicate (server)
      ]),
    );
    expect(await screen.findByText("Trùng với dòng 2 trong file")).toBeInTheDocument();
    expect(screen.getByText("Trùng với bản ghi đã có (quyết định 77/QĐ-A)")).toBeInTheDocument();
    expect(screen.getAllByText("Có thể trùng")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Nhập 1 dòng hợp lệ" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Nhập cả 2 dòng có thể trùng" }));
    await user.click(screen.getByRole("button", { name: "Nhập 3 dòng hợp lệ" }));

    expect(await screen.findByText("Đã nhập 3 khen thưởng")).toBeInTheDocument();
    const [commit] = lots(calls, false);
    expect(commit).toMatchObject({ include_duplicates: true, total_rows: 3, client_error_rows: 0 });
    expect(commit?.batch_id).toBeUndefined();
    await waitFor(() =>
      expect(calls.some((c) => c.method === "GET" && c.path === "/api/awards")).toBe(true),
    );
  });

  it("commits in lots of 30 reusing the batch id, then returns to the list", async () => {
    const { calls } = setup(importHandler());
    const user = await openImportTab();
    const body = Array.from({ length: 70 }, (_, i) => sheetRow({ Năm: 1990 + i }));
    await upload(user, xlsxFile([HEADERS, ...body]));
    await user.click(await screen.findByRole("button", { name: "Nhập 70 dòng hợp lệ" }));

    expect(await screen.findByText("Đã nhập 70 khen thưởng")).toBeInTheDocument();
    const commits = lots(calls, false);
    expect(commits.map((b) => b.rows.length)).toEqual([30, 30, 10]);
    expect(commits.map((b) => b.batch_id)).toEqual([undefined, 77, 77]);
    expect(lots(calls, true).map((b) => b.rows.length)).toEqual([30, 30, 10]);
    expect(
      await screen.findByRole("heading", { name: "Danh hiệu, khen thưởng" }),
    ).toBeInTheDocument();
  });

  it("stops on a failed lot and tells how many rows were saved", async () => {
    const { calls } = setup(importHandler({ failLot: 2 }));
    const user = await openImportTab();
    const body = Array.from({ length: 40 }, (_, i) => sheetRow({ Năm: 1990 + i }));
    await upload(user, xlsxFile([HEADERS, ...body]));
    await user.click(await screen.findByRole("button", { name: "Nhập 40 dòng hợp lệ" }));

    expect(await screen.findByText(/Đã lưu 30 khen thưởng \(đợt import #77\)/)).toBeInTheDocument();
    expect(screen.getByText("Lỗi máy chủ")).toBeInTheDocument();
    expect(lots(calls, false)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Nhập 40 dòng hợp lệ" })).toBeEnabled();
  });

  it("rejects a file with missing columns and allows picking another file", async () => {
    setup(importHandler());
    const user = await openImportTab();
    const headers = HEADERS.filter((h) => h !== "Năm");
    await upload(user, xlsxFile([headers, headers.map(() => "x")]));
    expect(await screen.findByRole("alert")).toHaveTextContent("File thiếu cột: Năm");
    expect(screen.getByLabelText("Chọn file import")).toBeInTheDocument();

    await upload(user, xlsxFile([HEADERS, sheetRow()]));
    expect(await screen.findByText("khen-thuong.xlsx")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(screen.getByLabelText("Chọn file import")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
  });

  it("downloads a template built from live master data", async () => {
    setup(importHandler());
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const user = await openImportTab();
    const btn = await screen.findByRole("button", { name: "Tải file mẫu (.xlsx)" });
    await waitFor(() => expect(btn).toBeEnabled());
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await user.click(btn);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });
});
