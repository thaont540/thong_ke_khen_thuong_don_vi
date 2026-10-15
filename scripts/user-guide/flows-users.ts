/** F08 users: list, add modal, temp password result, reset, lock / unlock. */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { openFromMenu, waitForRows } from "./guide-session";

export async function captureUsers(page: Page): Promise<void> {
  await page.goto("/");
  await openFromMenu(page, "Quản lý người dùng", "Quản lý người dùng");
  await waitForRows(page);
  const row = page.getByRole("row", { name: /bientap2\.demo/ });
  await shot(page, {
    name: "32-users-list",
    fullPage: true,
    callouts: [
      { at: page.getByRole("button", { name: "Thêm người dùng" }), n: 1, pos: "tr" },
      { at: page.locator("#users-search"), n: 2 },
      { at: page.getByRole("columnheader", { name: "Trạng thái" }), n: 3 },
      { at: row.getByRole("button", { name: "Sửa bientap2.demo" }), n: 4, pos: "tl" },
      { at: row.getByRole("button", { name: "Đặt lại mật khẩu bientap2.demo" }), n: 5, pos: "tl" },
      { at: row.getByRole("button", { name: "Khóa bientap2.demo" }), n: 6, pos: "tl" },
    ],
  });

  await page.getByRole("button", { name: "Thêm người dùng" }).click();
  const form = page.getByRole("dialog", { name: "Thêm người dùng" });
  await form.getByLabel(/^Tên đăng nhập/).fill("nguyen.van.a");
  await form.getByLabel(/^Họ tên/).fill("Nguyễn Văn A (mẫu)");
  await form.locator("#u-role").selectOption({ label: "Biên tập" });
  await form.getByRole("button", { name: "Tạo ngẫu nhiên" }).click();
  await shot(page, {
    name: "33-user-form",
    callouts: [
      { at: form.locator("#u-username"), n: 1 },
      { at: form.locator("#u-full-name"), n: 2 },
      { at: form.locator("#u-role"), n: 3 },
      { at: form.locator("#u-temp-password"), n: 4 },
      { at: form.getByRole("button", { name: "Tạo ngẫu nhiên" }), n: 5, pos: "tr" },
      { at: form.getByRole("button", { name: "Lưu" }), n: 6, pos: "tr" },
    ],
  });
  await form.getByRole("button", { name: "Lưu" }).click();
  const created = page.getByRole("dialog", { name: "Đã tạo người dùng" });
  await expect(created).toBeVisible();
  await shot(page, {
    name: "34-user-temp-password",
    callouts: [
      { at: created.locator(".confirm-text"), n: 1 },
      { at: created.getByTestId("temp-password"), n: 2 },
      { at: created.getByRole("button", { name: "Sao chép" }), n: 3, pos: "tr" },
    ],
  });
  await created.getByRole("button", { name: "Đóng", exact: true }).last().click();

  await page.getByRole("button", { name: "Đặt lại mật khẩu bientap2.demo" }).click();
  await page
    .getByRole("dialog", { name: "Đặt lại mật khẩu" })
    .getByRole("button", { name: "Đặt lại" })
    .click();
  const reset = page.getByRole("dialog", { name: "Đặt lại mật khẩu" });
  await expect(reset.getByTestId("temp-password")).toBeVisible();
  await shot(page, {
    name: "35-user-reset-password",
    callouts: [
      { at: reset.getByTestId("temp-password"), n: 1 },
      { at: reset.getByRole("button", { name: "Sao chép" }), n: 2, pos: "tr" },
    ],
  });
  await reset.getByRole("button", { name: "Đóng", exact: true }).last().click();

  await page.getByRole("button", { name: "Khóa bientap2.demo" }).click();
  const lock = page.getByRole("dialog", { name: "Khóa tài khoản" });
  await expect(lock).toBeVisible();
  await shot(page, {
    name: "36-user-lock-confirm",
    callouts: [
      { at: lock.locator(".confirm-text"), n: 1 },
      { at: lock.getByRole("button", { name: "Khóa", exact: true }), n: 2, pos: "tr" },
    ],
  });
  await lock.getByRole("button", { name: "Hủy" }).click();

  await page.getByRole("button", { name: "Mở khóa xem2.demo" }).click();
  const unlock = page.getByRole("dialog", { name: "Mở khóa tài khoản" });
  await expect(unlock).toBeVisible();
  await shot(page, {
    name: "37-user-unlock-confirm",
    callouts: [
      { at: unlock.locator(".confirm-text"), n: 1 },
      { at: unlock.getByRole("button", { name: "Mở khóa", exact: true }), n: 2, pos: "tr" },
    ],
  });
  await unlock.getByRole("button", { name: "Hủy" }).click();
}
