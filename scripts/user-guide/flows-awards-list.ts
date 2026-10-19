/** F01 list, filters, F02 officer modal, F09 edit banner and delete confirmation. */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { waitForRows } from "./guide-session";

export async function captureAwardsList(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  const first = page.locator("table.data tbody tr").nth(2); // an individual row
  await shot(page, {
    name: "10-awards-list",
    fullPage: true,
    callouts: [
      { at: page.getByRole("button", { name: "Thêm khen thưởng" }), n: 1, pos: "tr" },
      { at: page.locator("#f-unit"), n: 2 },
      { at: page.locator("#f-team"), n: 3 },
      { at: page.locator("#f-subject"), n: 4 },
      { at: page.locator("#f-form"), n: 5 },
      { at: page.locator("#f-q"), n: 6 },
      { at: page.getByRole("button", { name: "Xóa bộ lọc" }), n: 7, pos: "tr" },
      { at: page.locator(".summary"), n: 8, pos: "l" },
      { at: first.getByRole("button", { name: /^[A-ZÀ-Ỹ]/ }).first(), n: 9, pos: "l", pad: 2 },
      { at: first.locator(".row-actions"), n: 10, pos: "tr" },
      { at: page.locator(".pager"), n: 11, pos: "l" },
    ],
  });
}

export async function captureAwardsFiltered(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  await page.locator("#f-unit").selectOption({ label: "Phòng 6" });
  await page.locator("#f-subject").selectOption({ label: "Cá nhân" });
  await page.locator("#f-q").fill("hùng");
  await expect(page.locator("table.data tbody tr")).toHaveCount(4);
  await page.waitForLoadState("networkidle");
  await shot(page, {
    name: "11-awards-filtered",
    height: 640,
    callouts: [
      { at: page.locator("#f-unit"), n: 1 },
      { at: page.locator("#f-subject"), n: 2 },
      { at: page.locator("#f-q"), n: 3 },
      { at: page.locator(".summary"), n: 4, pos: "l" },
    ],
  });
}

export async function captureOfficerModal(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  await page.getByRole("button", { name: "Nguyễn Văn Hùng" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nguyễn Văn Hùng" });
  await expect(dialog.getByText("Quá trình thi đua, khen thưởng")).toBeVisible();
  await expect(dialog.locator("tbody tr").first()).toBeVisible();
  await shot(page, {
    name: "12-officer-modal",
    height: 1150,
    callouts: [
      { at: dialog.locator(".m-section").nth(1), n: 1, pos: "tr" },
      { at: dialog.getByRole("heading", { name: "Khen thưởng đang xem" }), n: 2, pos: "ir" },
      {
        at: dialog.getByRole("heading", { name: "Quá trình thi đua, khen thưởng" }),
        n: 3,
        pos: "ir",
      },
      { at: dialog.getByRole("button", { name: "Đóng", exact: true }).last(), n: 4, pos: "bl" },
      { at: dialog.getByRole("button", { name: "Thêm khen thưởng" }), n: 5, pos: "bl" },
      { at: dialog.getByRole("button", { name: "Sửa thông tin" }), n: 6, pos: "br" },
    ],
  });
  await dialog.getByRole("button", { name: "Đóng", exact: true }).first().click();
  await expect(dialog).toBeHidden();
}

export async function captureEditAward(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  await page.getByRole("button", { name: "Sửa khen thưởng của Trần Thị Lan Anh năm 2026" }).click();
  await expect(page.getByText(/^Đang sửa bản ghi/)).toBeVisible();
  await expect(page.locator("#a-decision")).toHaveValue("126/QĐ-P6");
  await shot(page, {
    name: "17-edit-award",
    fullPage: true,
    callouts: [
      { at: page.getByText(/^Đang sửa bản ghi/), n: 1 },
      { at: page.locator("#a-officer"), n: 2 },
      { at: page.locator("#a-award"), n: 3 },
      { at: page.locator("#a-decision"), n: 4 },
      { at: page.getByRole("button", { name: "Hủy" }), n: 5, pos: "tl" },
      { at: page.getByRole("button", { name: "Lưu thay đổi" }), n: 6, pos: "tr" },
    ],
  });
  await page.getByRole("button", { name: "Hủy" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function captureDeleteConfirm(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  await page
    .getByRole("button", { name: /^Xóa khen thưởng của Nguyễn Văn Hùng năm 2026$/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "Xóa khen thưởng" });
  await expect(dialog).toBeVisible();
  await shot(page, {
    name: "18-delete-confirm",
    callouts: [
      { at: dialog.locator(".confirm-text"), n: 1 },
      { at: dialog.getByRole("button", { name: "Hủy" }), n: 2, pos: "tl" },
      { at: dialog.getByRole("button", { name: "Xóa", exact: true }), n: 3, pos: "tr" },
    ],
  });
  await dialog.getByRole("button", { name: "Hủy" }).click();
}

/** F01 filter "Hình thức = Xếp loại cán bộ": only yearly rating records, counted in the stats line. */
export async function captureRatingFilter(page: Page): Promise<void> {
  await page.goto("/");
  await waitForRows(page);
  await page.locator("#f-form").selectOption({ label: "Xếp loại cán bộ" });
  await expect(page.locator("table.data tbody tr")).toHaveCount(8);
  await page.waitForLoadState("networkidle");
  await shot(page, {
    name: "40-awards-filter-rating",
    height: 760,
    callouts: [
      { at: page.locator("#f-form"), n: 1 },
      { at: page.locator("table.data tbody tr").first().locator("td").nth(4), n: 2, pos: "tl" },
      { at: page.locator(".summary"), n: 3, pos: "l" },
    ],
  });
}
