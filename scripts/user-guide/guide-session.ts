/** Browser contexts + login used by every capture flow. */
import { type Browser, expect, type Page } from "@playwright/test";
import { BASE_URL, DEMO_PASSWORD, DESKTOP, MOBILE } from "./guide-config";

export type Viewport = "desktop" | "mobile";

/** Fresh context (own cookies) with the fixed look of the guide: light scheme, Vietnamese locale. */
export async function newGuidePage(
  browser: Browser,
  viewport: Viewport = "desktop",
): Promise<Page> {
  const mobile = viewport === "mobile";
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport: mobile ? MOBILE : DESKTOP,
    deviceScaleFactor: 1,
    hasTouch: mobile,
  });
  return context.newPage();
}

export async function login(page: Page, username: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function loggedInPage(
  browser: Browser,
  username: string,
  viewport: Viewport = "desktop",
): Promise<Page> {
  const page = await newGuidePage(browser, viewport);
  await login(page, username);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  return page;
}

export async function openFromMenu(page: Page, link: string, heading: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: link })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Waits until the list table has rendered rows (data loaded). */
export async function waitForRows(page: Page): Promise<void> {
  await expect(page.locator("table.data tbody tr, table.data-sm tbody tr").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}
