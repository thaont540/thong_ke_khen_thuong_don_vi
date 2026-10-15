/** F06 units: list, view modal, edit modal with team editor, blocked delete. */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { openFromMenu, waitForRows } from "./guide-session";

export async function captureUnits(page: Page): Promise<void> {
  await page.goto("/");
  await openFromMenu(page, "Quản lý đơn vị", "Quản lý đơn vị");
  await waitForRows(page);
  const row = page.getByRole("row", { name: /Phòng 6/ });
  await shot(page, {
    name: "28-units-list",
    fullPage: true,
    callouts: [
      { at: page.getByRole("button", { name: "Thêm đơn vị" }), n: 1, pos: "tr" },
      { at: page.locator("#units-search"), n: 2 },
      { at: row.getByRole("button", { name: "Xem Phòng 6" }), n: 3, pos: "l" },
      { at: row.locator(".row-actions"), n: 4, pos: "tr" },
    ],
  });

  await row.getByRole("button", { name: "Xem Phòng 6" }).click();
  const view = page.getByRole("dialog", { name: /Phòng 6/ });
  await expect(view.getByText("Đội trực thuộc")).toBeVisible();
  await expect(view.getByRole("cell", { name: "Đội Tham mưu tổng hợp" })).toBeVisible();
  await shot(page, {
    name: "29-unit-detail",
    height: 1000,
    callouts: [
      { at: view.locator("table.data-sm").first(), n: 1 },
      { at: view.getByRole("heading", { name: "Đội trực thuộc" }), n: 2, pos: "ir" },
      { at: view.getByRole("button", { name: "Sửa đơn vị" }), n: 3, pos: "tr" },
      { at: view.getByRole("button", { name: "Đóng", exact: true }).last(), n: 4, pos: "tl" },
    ],
  });
  await view.getByRole("button", { name: "Sửa đơn vị" }).click();

  const form = page.getByRole("dialog", { name: "Sửa đơn vị" });
  await expect(form.getByLabel("Tên đội 1", { exact: true })).toBeVisible();
  await form.getByLabel("Tên đội 1", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, {
    name: "30-unit-form",
    height: 1300,
    callouts: [
      { at: form.locator("#unit-code"), n: 1 },
      { at: form.locator("#unit-kind"), n: 2 },
      { at: form.locator("#unit-name"), n: 3 },
      { at: form.locator("#unit-description"), n: 4 },
      { at: form.getByLabel("Tên đội 1", { exact: true }), n: 5, pos: "tl" },
      { at: form.getByRole("button", { name: "Xóa đội 1" }), n: 6, pos: "tr" },
      { at: form.getByRole("button", { name: "Thêm đội" }), n: 7, pos: "tl" },
      { at: form.getByRole("button", { name: "Lưu" }), n: 8, pos: "tr" },
    ],
  });
  await form.getByRole("button", { name: "Hủy" }).click();
  await expect(form).toBeHidden();

  await row.getByRole("button", { name: "Xóa Phòng 6" }).click();
  const blocked = page.getByRole("dialog", { name: "Chưa thể xóa đơn vị" });
  await expect(blocked).toBeVisible();
  await shot(page, {
    name: "31-unit-delete-blocked",
    callouts: [
      { at: blocked.locator(".confirm-text"), n: 1 },
      { at: blocked.getByRole("button", { name: "Đóng", exact: true }).last(), n: 2, pos: "tr" },
    ],
  });
  await blocked.getByRole("button", { name: "Đóng", exact: true }).last().click();
}
