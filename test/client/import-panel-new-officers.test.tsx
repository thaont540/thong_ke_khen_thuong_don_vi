/// <reference types="node" />
import { readFileSync } from "node:fs";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { readImportFile } from "../../src/client/pages/awards/import/excel-file-reader";
import type { ImportRow } from "../../src/shared/schemas/award-import-schemas";
import { listBody, master, officerOption } from "./helpers/award-fixtures";
import { HEADERS, sheetRow, xlsxFile } from "./helpers/import-file-builders";
import { makeMe, mockApi, renderApp } from "./helpers/render-with-providers";

const RATING = {
  "Hình thức": "Xếp loại cán bộ",
  "Danh hiệu / khen thưởng": "Hoàn thành xuất sắc nhiệm vụ",
};
const NEW_PERSON = { "Họ và tên": "Lê Văn Mới", Đội: "" };

function setup() {
  return mockApi({
    "GET /api/me": { body: makeMe("EDITOR") },
    "GET /api/master": { body: master },
    "GET /api/officers/options": { body: { items: [officerOption()] } },
    "GET /api/awards": { body: listBody([]) },
    "POST /api/awards/import": ({ body }: { body: unknown }) => ({
      body: {
        batch_id: null,
        imported_count: 0,
        results: (body as { rows: ImportRow[] }).rows.map((r) => ({
          row_number: r.row_number,
          status: "OK",
          errors: [],
          duplicate_messages: [],
          imported: false,
        })),
      },
    }),
  });
}

async function previewOf(rows: ReturnType<typeof sheetRow>[]) {
  setup();
  const user = userEvent.setup();
  renderApp("/awards/new");
  await user.click(await screen.findByRole("tab", { name: "Import từ Excel" }));
  await user.upload(await screen.findByLabelText("Chọn file import"), xlsxFile([HEADERS, ...rows]));
  await screen.findByText(/dòng,/);
  return screen.getAllByRole("row").slice(1) as HTMLElement[];
}

describe("F04 preview with the new template", () => {
  it("marks officers to be created with a badge and a note, existing ones without", async () => {
    const rows = await previewOf([sheetRow(), sheetRow({ ...NEW_PERSON, Năm: 2025 })]);
    expect(within(rows[0] as HTMLElement).queryByText("mới")).not.toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByText("Sẽ tạo cán bộ mới")).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Lê Văn Mới")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("mới")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Sẽ tạo cán bộ mới")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Hợp lệ")).toBeInTheDocument();
  });

  it("shows the form column incl. Xếp loại cán bộ and rejects a second rating of the officer-year", async () => {
    const rows = await previewOf([
      sheetRow(),
      sheetRow(RATING),
      sheetRow({ ...RATING, "Số quyết định": "2/QĐ" }),
    ]);
    expect(within(rows[0] as HTMLElement).getByText("Danh hiệu")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Xếp loại cán bộ")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Hợp lệ")).toBeInTheDocument();
    expect(rows[2]).toHaveClass("row-err");
    expect(
      within(rows[2] as HTMLElement).getByText(
        "Cán bộ đã có xếp loại năm 2026 (trùng với dòng 3 trong file)",
      ),
    ).toBeInTheDocument();
  });

  it("a Tập thể row with a name is an error row", async () => {
    const rows = await previewOf([
      sheetRow({
        "Đối tượng": "Tập thể",
        "Hình thức": "Khen thưởng",
        "Danh hiệu / khen thưởng": "Giấy khen",
      }),
    ]);
    expect(
      within(rows[0] as HTMLElement).getByText("Tập thể không ghi họ tên, cấp bậc, chức vụ"),
    ).toBeInTheDocument();
  });
});

describe("provided sample file mau-import-khen-thuong.xlsx", () => {
  it("is read as five rows of the new layout", async () => {
    const bytes = readFileSync("test/client/fixtures/mau-import-khen-thuong.xlsx");
    const parsed = await readImportFile(new File([bytes], "mau-import-khen-thuong.xlsx"));
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[0]).toMatchObject({
      subject: "Cá nhân",
      full_name: "Nguyễn Văn A",
      rank: "Đại tá",
      position: "Trưởng phòng",
      unit: "Phòng 7",
      team: "Đội Dẫn đoàn số 1",
      form: "Danh hiệu",
      decision_date: "15/09/2026",
      authority: "Cục trưởng Cục CSGT",
    });
    expect(parsed.rows[1]).toMatchObject({
      subject: "Tập thể",
      full_name: "",
      rank: "",
      position: "",
    });
    expect(parsed.rows.slice(3).map((r) => r.form)).toEqual(["Xếp loại cán bộ", "Xếp loại cán bộ"]);
  });
});
