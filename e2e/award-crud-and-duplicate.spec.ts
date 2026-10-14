import { fillPersonalAwardForm } from "./helpers/award-form-helpers";
import { expect, test } from "./helpers/test";
import { loginViaForm, openFromMenu } from "./helpers/ui-helpers";

test("admin sets up unit, team and officer; editor adds an award and confirms a duplicate", async ({
  browser,
  page,
}) => {
  // Admin: unit with one team.
  await loginViaForm(page, "admin");
  await openFromMenu(page, "Quản lý đơn vị", "Quản lý đơn vị");
  await page.getByRole("button", { name: "Thêm đơn vị" }).click();
  const unitDialog = page.getByRole("dialog", { name: "Thêm đơn vị" });
  await unitDialog.getByLabel(/^Mã đơn vị/).fill("E2E1");
  await unitDialog.getByLabel(/^Tên đơn vị/).fill("Phòng E2E");
  await unitDialog.getByRole("button", { name: "Thêm đội" }).click();
  await unitDialog.getByLabel("Tên đội 1").fill("Đội E2E 1");
  await unitDialog.getByRole("button", { name: "Lưu" }).click();
  await page.getByRole("searchbox", { name: "Tìm kiếm" }).fill("E2E"); // 11 units > one page
  await expect(page.getByRole("row", { name: /Phòng E2E/ })).toBeVisible();

  // Admin: officer in that team.
  await openFromMenu(page, "Quản lý cán bộ", "Quản lý cán bộ");
  await page.getByRole("button", { name: "Thêm cán bộ" }).click();
  const officerDialog = page.getByRole("dialog", { name: "Thêm cán bộ" });
  await officerDialog.getByLabel(/^Họ tên/).fill("Nguyễn Văn E2E");
  await officerDialog.getByLabel(/^Năm sinh/).fill("1990");
  await officerDialog.getByLabel(/^Số hiệu/).fill("123456");
  await officerDialog.locator("#of-rank").selectOption({ index: 1 });
  await officerDialog.locator("#of-position").selectOption({ index: 1 });
  await officerDialog.locator("#of-unit").selectOption({ label: "Phòng E2E" });
  await officerDialog.locator("#of-team").selectOption({ label: "Đội E2E 1" });
  await officerDialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("row", { name: /Nguyễn Văn E2E/ })).toBeVisible();

  // Editor (separate browser context = separate session): add the same award twice.
  const editorContext = await browser.newContext();
  const editor = await editorContext.newPage();
  await loginViaForm(editor, "editor");
  const input = { unit: "Phòng E2E", team: "Đội E2E 1", officer: "Nguyễn Văn E2E" };

  await editor.goto("/awards/new");
  await fillPersonalAwardForm(editor, { ...input, decision: "01/QĐ-E2E" });
  await editor.getByRole("button", { name: "Lưu khen thưởng" }).click();
  await expect(editor).toHaveURL(/\/$/);
  await expect(editor.getByRole("row", { name: /Nguyễn Văn E2E/ })).toHaveCount(1);

  await editor.goto("/awards/new");
  await fillPersonalAwardForm(editor, { ...input, decision: "02/QĐ-E2E" });
  await editor.getByRole("button", { name: "Lưu khen thưởng" }).click();
  const dup = editor.getByRole("dialog", { name: "Có thể bị trùng" });
  await expect(dup).toContainText("01/QĐ-E2E");
  await dup.getByRole("button", { name: "Vẫn lưu" }).click();

  await expect(editor).toHaveURL(/\/$/);
  await expect(editor.getByRole("row", { name: /Nguyễn Văn E2E/ })).toHaveCount(2);
  await editorContext.close();
});
