/** Phone layout (390x844): menu strip + list, and the add form. */
import type { Browser } from "@playwright/test";
import { shot } from "./annotate";
import { loggedInPage, waitForRows } from "./guide-session";

export async function captureMobile(browser: Browser): Promise<void> {
  const page = await loggedInPage(browser, "quantri.demo", "mobile");
  await page.goto("/");
  await waitForRows(page);
  await shot(page, {
    name: "38-mobile-list",
    callouts: [
      { at: page.getByRole("navigation", { name: "Điều hướng chính" }), n: 1, pos: "bl" },
      { at: page.locator("#f-unit"), n: 2, pos: "tl" },
      { at: page.locator("table.data").first(), n: 3, pos: "tr" },
    ],
  });
  await page.goto("/awards/new");
  await page.locator("#a-unit").waitFor();
  await page.waitForLoadState("networkidle");
  await shot(page, {
    name: "39-mobile-add-award",
    callouts: [
      { at: page.getByRole("tab", { name: "Import từ Excel" }), n: 1, pos: "tr" },
      { at: page.locator("#a-unit"), n: 2, pos: "tl" },
    ],
  });
  await page.context().close();
}
