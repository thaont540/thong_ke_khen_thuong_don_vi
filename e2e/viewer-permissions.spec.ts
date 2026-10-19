import { seedOfficer, seedPersonalAward, withE2eDb } from "./helpers/seed-e2e-database";
import { expect, test } from "./helpers/test";
import { loginViaForm } from "./helpers/ui-helpers";

test.beforeEach(() => {
  withE2eDb((db) => {
    seedOfficer(db, { id: 1, name: "Trần Thị Xem", unitId: 6, teamId: 1 });
    seedPersonalAward(db, {
      officerId: 1,
      unitId: 6,
      teamId: 1,
      year: 2025,
      decision: "10/QĐ-XEM",
    });
  });
});

test("viewer sees two menu items, is redirected away from admin screens and cannot edit in the officer modal", async ({
  page,
}) => {
  await loginViaForm(page, "viewer");
  const menu = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(menu.getByRole("link")).toHaveCount(2);
  await expect(menu.getByRole("link", { name: "Danh hiệu, khen thưởng" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Văn bản quy định" })).toBeVisible();

  await page.goto("/units");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Bạn không có quyền truy cập chức năng này")).toBeVisible();

  // No write actions on the list; the officer modal offers Đóng only.
  await expect(page.getByRole("button", { name: "Thêm khen thưởng" })).toHaveCount(0);
  await page.getByRole("button", { name: "Trần Thị Xem" }).click();
  const modal = page.getByRole("dialog", { name: "Trần Thị Xem" });
  await expect(modal).toContainText("10/QĐ-XEM");
  await expect(modal.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Thêm khen thưởng" })).toHaveCount(0);
  await expect(modal.locator("button.btn")).toHaveText(["Đóng"]);
  await modal.locator("button.btn").click();
  await expect(modal).toBeHidden();
});
