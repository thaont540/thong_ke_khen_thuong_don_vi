import { expect, type Page } from "@playwright/test";
import { ACCOUNTS } from "./seed-e2e-database";

export type AccountKey = keyof typeof ACCOUNTS;

/** Logs in through the real form; returns once the shell (or forced-change page) is shown. */
export async function loginViaForm(page: Page, who: AccountKey, password?: string): Promise<void> {
  const account = ACCOUNTS[who];
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(account.username);
  await page.getByLabel("Mật khẩu").fill(password ?? account.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens the sidebar link and waits for the page heading. */
export async function openFromMenu(page: Page, link: string, heading: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: link })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}
