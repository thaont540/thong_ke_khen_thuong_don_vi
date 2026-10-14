import { ACCOUNTS, resetE2eData } from "./helpers/seed-e2e-database";
import { expect, test } from "./helpers/test";
import { loginViaForm } from "./helpers/ui-helpers";

test.beforeEach(() => resetE2eData({ adminMustChange: true }));

test("admin first login is forced to change the password, then lands on the awards list", async ({
  page,
}) => {
  await loginViaForm(page, "admin");
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByText("Bạn cần đổi mật khẩu trước khi sử dụng hệ thống.")).toBeVisible();

  // Any other screen is unreachable until the password is changed.
  await page.goto("/units");
  await expect(page).toHaveURL(/\/change-password$/);

  const next = "E2e-New-Password9";
  await page.getByLabel("Mật khẩu hiện tại").fill(ACCOUNTS.admin.password);
  await page.getByLabel(/^Mật khẩu mới/).fill(next);
  await page.getByLabel("Nhập lại mật khẩu mới").fill(next);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Danh hiệu, khen thưởng" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Quản lý người dùng" })).toBeVisible();

  // The old password no longer works, the new one does.
  await page.context().clearCookies();
  await loginViaForm(page, "admin", next);
  await expect(page).toHaveURL(/\/$/);
});
