import * as XLSX from "xlsx";
import { IMPORT_COLUMNS } from "../src/shared/import/import-column-definitions";
import { seedOfficer, seedPersonalAward, withE2eDb } from "./helpers/seed-e2e-database";
import { expect, test } from "./helpers/test";
import { loginViaForm } from "./helpers/ui-helpers";

const HEADERS = IMPORT_COLUMNS.map((c) => c.header);

const row = (id: number, year: number, decision: string, unit = "Phòng 6"): (string | number)[] => {
  const cells: Record<string, string | number> = {
    "Đối tượng": "Cá nhân",
    "Họ và tên": `Cán bộ Import ${id}`,
    "Cấp bậc": "Đại úy",
    "Chức vụ": "Cán bộ",
    "Đơn vị": unit,
    "Hình thức": "Danh hiệu",
    "Danh hiệu / khen thưởng": "Chiến sĩ thi đua cơ sở",
    Năm: year,
    "Số quyết định": decision,
    "Ngày quyết định": "15/09/2026",
    "Chi tiết giải thưởng": "Hoàn thành xuất sắc nhiệm vụ",
  };
  return HEADERS.map((h) => cells[h] ?? "");
};

function workbook(rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), "Khen thưởng");
  return {
    name: "khen-thuong-e2e.xlsx",
    mimeType: "application/octet-stream",
    buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer,
  };
}

test.beforeEach(() => {
  withE2eDb((db) => {
    for (const id of [1, 2, 3]) seedOfficer(db, { id, name: `Cán bộ Import ${id}`, unitId: 6 });
    seedPersonalAward(db, { officerId: 1, unitId: 6, year: 2024, decision: "99/QĐ-CU" });
  });
});

test("import: 3 valid rows go in, the duplicate only with its checkbox, the error row never", async ({
  page,
}) => {
  const file = workbook([
    row(1, 2021, "01/QĐ-IMP"),
    row(2, 2021, "02/QĐ-IMP"),
    row(3, 2021, "03/QĐ-IMP"),
    row(9, 2021, "04/QĐ-IMP", "Phòng 99"), // unknown unit -> error
    row(1, 2024, "05/QĐ-IMP"), // same officer/type/year as the stored award -> duplicate
  ]);
  await loginViaForm(page, "editor");
  await page.goto("/awards/new");
  await page.getByRole("tab", { name: "Import từ Excel" }).click();
  await page.getByLabel("Chọn file import").setInputFiles(file);

  await expect(page.getByText("5 dòng")).toBeVisible();
  await expect(page.getByText("3 hợp lệ")).toBeVisible();
  await expect(page.getByText("1 có thể trùng")).toBeVisible();
  await expect(page.getByText("1 lỗi")).toBeVisible();

  const commit = page.getByRole("button", { name: /^Nhập \d+ dòng hợp lệ$/ });
  await expect(commit).toHaveText("Nhập 3 dòng hợp lệ");
  const includeDuplicates = page.getByLabel("Nhập cả 1 dòng có thể trùng");
  await includeDuplicates.check();
  await expect(commit).toHaveText("Nhập 4 dòng hợp lệ");
  await includeDuplicates.uncheck();
  await expect(commit).toHaveText("Nhập 3 dòng hợp lệ");

  await commit.click();
  await expect(page.getByText(/Đã nhập 3/)).toBeVisible();

  // Second pass with the same file: the 3 are now duplicates of what was just imported.
  await page.goto("/awards/new");
  await page.getByRole("tab", { name: "Import từ Excel" }).click();
  await page.getByLabel("Chọn file import").setInputFiles(file);
  await expect(page.getByText("0 hợp lệ")).toBeVisible();
  await expect(page.getByText("4 có thể trùng")).toBeVisible();
  await page.getByLabel("Nhập cả 4 dòng có thể trùng").check();
  await expect(page.getByRole("button", { name: "Nhập 4 dòng hợp lệ" })).toBeVisible();
  await page.getByRole("button", { name: "Nhập 4 dòng hợp lệ" }).click();
  await expect(page.getByText(/Đã nhập 4/)).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("row", { name: /Cán bộ Import/ })).toHaveCount(8); // 7 imported + 1 stored
});
