import { ACCOUNTS } from "./helpers/seed-e2e-database";
import { expect, test } from "./helpers/test";
import { loginViaForm, openFromMenu } from "./helpers/ui-helpers";

test("locking a user ends their session on the next request and blocks logging back in", async ({
  browser,
  page,
}) => {
  const editorContext = await browser.newContext();
  const editor = await editorContext.newPage();
  await loginViaForm(editor, "editor");
  await expect(
    editor.getByRole("heading", { level: 1, name: "Danh hiệu, khen thưởng" }),
  ).toBeVisible();

  await loginViaForm(page, "admin");
  await openFromMenu(page, "Quản lý người dùng", "Quản lý người dùng");
  await page.getByRole("button", { name: `Khóa ${ACCOUNTS.editor.username}` }).click();
  await page
    .getByRole("dialog", { name: "Khóa tài khoản" })
    .getByRole("button", { name: "Khóa", exact: true })
    .click();
  await expect(page.getByRole("row", { name: new RegExp(ACCOUNTS.editor.username) })).toContainText(
    "Đã khóa",
  );

  // The editor's very next request is rejected with 401 and the app falls back to the login page.
  await editor.reload();
  await expect(editor).toHaveURL(/\/login/);

  await editor.getByLabel("Tên đăng nhập").fill(ACCOUNTS.editor.username);
  await editor.getByLabel("Mật khẩu").fill(ACCOUNTS.editor.password);
  await editor.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(editor.getByRole("alert")).toContainText("Tài khoản đang bị khóa");
  await expect(editor).toHaveURL(/\/login/);
  await editorContext.close();
});
