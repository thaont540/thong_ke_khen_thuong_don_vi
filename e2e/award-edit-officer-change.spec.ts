import { selectOptionContaining } from "./helpers/award-form-helpers";
import { seedOfficer, seedPersonalAward, withE2eDb } from "./helpers/seed-e2e-database";
import { expect, test } from "./helpers/test";
import { loginViaForm } from "./helpers/ui-helpers";

test.beforeEach(() => {
  withE2eDb((db) => {
    seedOfficer(db, { id: 1, name: "Lê Văn Cũ", unitId: 6, teamId: 1 });
    seedOfficer(db, { id: 2, name: "Phạm Thị Mới", unitId: 7, teamId: 12 });
    seedPersonalAward(db, {
      officerId: 1,
      unitId: 6,
      teamId: 1,
      year: 2025,
      decision: "20/QĐ-SUA",
    });
  });
});

test("editing an award to another officer moves it to that officer's unit and team; deleting stays on the list", async ({
  page,
}) => {
  await loginViaForm(page, "editor");
  const original = page.getByRole("row", { name: /Lê Văn Cũ/ });
  await expect(original).toContainText("Phòng 6 / Đội CSGT đường bộ cao tốc số 1");

  await page.getByRole("button", { name: "Sửa khen thưởng của Lê Văn Cũ năm 2025" }).click();
  await expect(page).toHaveURL(/\/awards\/\d+\/edit/);
  await page.locator("#a-unit").selectOption({ label: "Phòng 7" });
  await selectOptionContaining(page.locator("#a-officer"), "Phạm Thị Mới");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page).toHaveURL(/\/$/);
  const moved = page.getByRole("row", { name: /Phạm Thị Mới/ });
  await expect(moved).toContainText("Phòng 7 / "); // unit and team follow the new officer
  await expect(page.getByRole("row", { name: /Lê Văn Cũ/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Xóa khen thưởng của Phạm Thị Mới năm 2025" }).click();
  const confirm = page.getByRole("dialog", { name: "Xóa khen thưởng" });
  await expect(confirm).toContainText("20/QĐ-SUA");
  await confirm.getByRole("button", { name: "Xóa", exact: true }).click();

  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("row", { name: /Phạm Thị Mới/ })).toHaveCount(0);
});
