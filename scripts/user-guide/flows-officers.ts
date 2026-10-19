/** F05 officers list, add/edit modal (join month, rating, seniority), validation and delete. */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { openFromMenu, waitForRows } from "./guide-session";

export async function captureOfficers(page: Page): Promise<void> {
  await page.goto("/");
  await openFromMenu(page, "Quản lý cán bộ", "Quản lý cán bộ");
  await waitForRows(page);
  const row = page.getByRole("row", { name: /Nguyễn Văn Hùng/ });
  await shot(page, {
    name: "24-officers-list",
    height: 900,
    callouts: [
      { at: page.getByRole("button", { name: "Thêm cán bộ" }), n: 1, pos: "tr" },
      { at: page.locator("#of-filter-unit"), n: 2 },
      { at: page.locator("#of-filter-team"), n: 3 },
      { at: page.locator("#officers-search"), n: 4 },
      { at: row.getByRole("link", { name: "Xem Nguyễn Văn Hùng" }), n: 5, pos: "l", pad: 2 },
      { at: page.getByRole("columnheader", { name: "Vào ngành" }), n: 6 },
      { at: page.getByRole("columnheader", { name: "Thâm niên" }), n: 7 },
      { at: page.getByRole("columnheader", { name: "Xếp loại" }), n: 8 },
      { at: row.locator(".row-actions"), n: 9, pos: "tr" },
    ],
  });
}

export async function captureOfficerForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Thêm cán bộ" }).click();
  const d = page.getByRole("dialog", { name: "Thêm cán bộ" });
  await d.getByLabel(/^Họ tên/).fill("Trần Văn Mẫu");
  await d.getByLabel(/^Năm sinh/).fill("1992");
  await d.getByLabel(/^Số hiệu/).fill("200001");
  await d.locator("#of-rank").selectOption({ label: "Đại úy" });
  await d.locator("#of-position").selectOption({ label: "Cán bộ" });
  await d.locator("#of-unit").selectOption({ label: "Phòng 6" });
  await d.locator("#of-team").selectOption({ label: "Đội CSGT đường bộ cao tốc số 3" });
  await d.locator("#of-joined").fill("2015-09");
  await shot(page, {
    name: "25-officer-form",
    height: 900,
    callouts: [
      { at: d.locator("#of-code"), n: 1 },
      { at: d.locator("#of-name"), n: 2 },
      { at: d.locator("#of-year"), n: 3 },
      { at: d.locator("#of-badge"), n: 4 },
      { at: d.locator("#of-rank"), n: 5 },
      { at: d.locator("#of-position"), n: 6 },
      { at: d.locator("#of-unit"), n: 7 },
      { at: d.locator("#of-team"), n: 8 },
      { at: d.locator("#of-joined"), n: 9 },
      { at: d.getByRole("button", { name: "Lưu" }), n: 10, pos: "tr" },
      { at: d.getByRole("button", { name: "Hủy" }), n: 11, pos: "tl" },
    ],
  });

  // Validation: bad badge number, birth year, and a join month before age 16.
  await d.getByLabel(/^Số hiệu/).fill("12ab");
  await d.getByLabel(/^Năm sinh/).fill("1992");
  await d.locator("#of-joined").fill("2005-01");
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d.locator(".err").first()).toBeVisible();
  await shot(page, {
    name: "26-officer-form-errors",
    height: 900,
    callouts: [
      { at: d.locator("#of-badge-error"), n: 1, pos: "tr" },
      { at: d.locator("#of-joined-error"), n: 2, pos: "tr" },
    ],
  });
  await d.getByRole("button", { name: "Hủy" }).click();
  await expect(d).toBeHidden();
}

export async function captureOfficerDelete(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Xóa Phan Văn Bình" }).click();
  const d = page.getByRole("dialog", { name: "Xóa cán bộ" });
  await expect(d).toBeVisible();
  await shot(page, {
    name: "27-officer-delete-confirm",
    callouts: [
      { at: d.locator(".confirm-text"), n: 1 },
      { at: d.getByRole("button", { name: "Hủy" }), n: 2, pos: "tl" },
      { at: d.getByRole("button", { name: "Xóa", exact: true }), n: 3, pos: "tr" },
    ],
  });
  await d.getByRole("button", { name: "Hủy" }).click();
}
