/** F04 import from Excel (14-column template): tab, preview with OK / new officer / duplicate / error rows, commit. */
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { writeDemoImportFile } from "./demo-import-file";

export async function captureImport(page: Page): Promise<void> {
  await page.goto("/awards/new");
  await page.getByRole("tab", { name: "Import từ Excel" }).click();
  const template = page.getByRole("button", { name: "Tải file mẫu (.xlsx)" });
  await expect(template).toBeEnabled();
  const dropzone = page.locator("label.dropzone");

  // Smoke-check that the template really downloads before documenting it.
  const [download] = await Promise.all([page.waitForEvent("download"), template.click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  await shot(page, {
    name: "20-import-tab",
    height: 700,
    callouts: [
      { at: page.getByRole("tab", { name: "Import từ Excel" }), n: 1 },
      { at: template, n: 2, pos: "tr" },
      { at: dropzone, n: 3 },
    ],
  });

  const demoFile = writeDemoImportFile();
  await page.getByLabel("Chọn file import").setInputFiles(demoFile);
  await expect(page.getByText("9 dòng")).toBeVisible();
  await expect(page.locator("tr.row-err")).toHaveCount(2);
  await expect(page.locator("tr.row-warn")).toHaveCount(2);
  const commit = page.getByRole("button", { name: /^Nhập \d+ dòng hợp lệ$/ });
  await expect(commit).toHaveText("Nhập 5 dòng hợp lệ");

  const newBadge = page.locator(".new-officer-badge").first();
  await expect(newBadge).toBeVisible();
  const include = page.getByLabel(/^Nhập cả \d+ dòng có thể trùng/);
  await shot(page, {
    name: "21-import-preview",
    fullPage: true,
    callouts: [
      { at: page.locator(".import-head p"), n: 1 },
      { at: page.getByRole("columnheader", { name: "Trạng thái" }), n: 2 },
      { at: newBadge, n: 3, pos: "r", pad: 2 },
      { at: page.locator("tr.row-warn").first(), n: 4, pos: "l", pad: 1 },
      { at: page.locator("tr.row-err").first(), n: 5, pos: "l", pad: 1 },
      { at: page.locator(".check-inline"), n: 6 },
      { at: page.getByRole("button", { name: "Chọn file khác" }), n: 7, pos: "tl" },
      { at: commit, n: 8, pos: "tr" },
    ],
  });

  await include.check();
  await expect(commit).toHaveText("Nhập 7 dòng hợp lệ");
  await shot(page, {
    name: "22-import-include-duplicates",
    height: 560,
    callouts: [
      { at: page.locator(".check-inline"), n: 1 },
      { at: commit, n: 2, pos: "tr" },
    ],
  });
  await include.uncheck();
  rmSync(dirname(demoFile), { recursive: true, force: true });
  await commit.click();
  await expect(page.getByText(/Đã nhập 5/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await shot(page, {
    name: "23-import-done",
    height: 640,
    callouts: [
      { at: page.locator(".toast").first(), n: 1, pos: "tl" },
      { at: page.locator(".summary"), n: 2, pos: "l" },
    ],
  });
}
