/** Login, forced password change, role menus and the user menu (F07 + role matrix). */
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { DEMO_PASSWORD } from "./guide-config";
import { login, newGuidePage, waitForRows } from "./guide-session";

const MENU = "Điều hướng chính";
/** Phòng 7 has few awards: the page stays one screen tall so the user menu (page bottom) is visible. */
export const SHORT_LIST = "/?unit_id=7";

async function submitLogin(page: Page, username: string, password: string): Promise<void> {
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

export async function captureLogin(browser: Browser): Promise<void> {
  const page = await newGuidePage(browser);
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("bientap.demo");
  await page.getByLabel("Mật khẩu").fill("matkhau-cua-ban");
  await shot(page, {
    name: "01-login",
    callouts: [
      { at: page.getByLabel("Tên đăng nhập"), n: 1 },
      { at: page.getByLabel("Mật khẩu"), n: 2 },
      { at: page.getByRole("button", { name: "Đăng nhập" }), n: 3 },
    ],
  });

  await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert")).toContainText("Tên đăng nhập hoặc mật khẩu không đúng");
  await shot(page, { name: "02-login-error", callouts: [{ at: page.getByRole("alert"), n: 1 }] });

  await submitLogin(page, "xem2.demo", DEMO_PASSWORD);
  await expect(page.getByRole("alert")).toContainText("Tài khoản đang bị khóa");
  await shot(page, { name: "03-login-locked", callouts: [{ at: page.getByRole("alert"), n: 1 }] });
  await page.context().close();
}

export async function captureForcedPasswordChange(browser: Browser): Promise<void> {
  const page = await newGuidePage(browser);
  await login(page, "nguoimoi.demo");
  await expect(page).toHaveURL(/\/change-password$/);
  const current = page.getByLabel("Mật khẩu hiện tại");
  const next = page.getByLabel(/^Mật khẩu mới/);
  const again = page.getByLabel("Nhập lại mật khẩu mới");
  await current.fill(DEMO_PASSWORD);
  await next.fill("MatKhauMoi-2026");
  await again.fill("MatKhauMoi-2026");
  await shot(page, {
    name: "04-change-password",
    callouts: [
      { at: page.getByText("Bạn cần đổi mật khẩu trước khi sử dụng hệ thống."), n: 1 },
      { at: current, n: 2 },
      { at: next, n: 3 },
      { at: again, n: 4 },
      { at: page.getByRole("button", { name: "Đổi mật khẩu" }), n: 5 },
    ],
  });

  await next.fill("ngan");
  await again.fill("khac");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.locator(".err").first()).toBeVisible();
  await shot(page, {
    name: "05-change-password-error",
    callouts: [
      { at: page.locator(".field.invalid").nth(0), n: 1 },
      { at: page.locator(".field.invalid").nth(1), n: 2 },
    ],
  });
  await page.context().close();
}

/** Same screen for the three roles: only the menu (and the add button) differs. */
export async function captureRoleMenus(pages: {
  admin: Page;
  editor: Page;
  viewer: Page;
}): Promise<void> {
  const nav = (p: Page) => p.getByRole("navigation", { name: MENU });
  const link = (p: Page, name: string) => nav(p).getByRole("link", { name });
  const who = (p: Page) => p.locator(".side-user");

  for (const [key, name, page] of [
    ["admin", "06-menu-admin", pages.admin],
    ["editor", "07-menu-editor", pages.editor],
    ["viewer", "08-menu-viewer", pages.viewer],
  ] as const) {
    await page.goto(SHORT_LIST);
    await waitForRows(page);
    const callouts = [
      { at: link(page, "Danh hiệu, khen thưởng"), n: 1, pos: "ir" as const, pad: 2 },
      ...(key === "viewer"
        ? []
        : [{ at: link(page, "Thêm khen thưởng"), n: 2, pos: "ir" as const, pad: 2 }]),
      ...(key === "admin"
        ? [
            { at: link(page, "Quản lý cán bộ"), n: 3, pos: "ir" as const, pad: 2 },
            { at: link(page, "Quản lý đơn vị"), n: 4, pos: "ir" as const, pad: 2 },
            { at: link(page, "Quản lý người dùng"), n: 5, pos: "ir" as const, pad: 2 },
          ]
        : []),
      { at: who(page), n: 6, pos: "tr" as const },
    ];
    await shot(page, { name, callouts });
  }
}

export async function captureUserMenu(page: Page): Promise<void> {
  await page.goto(SHORT_LIST);
  await waitForRows(page);
  await shot(page, {
    name: "09-user-menu",
    clipTo: page.locator("aside.side"),
    callouts: [
      { at: page.locator(".side-user .who"), n: 1, pos: "tr" },
      { at: page.locator(".side-user .role"), n: 2, pos: "tr" },
      { at: page.getByRole("button", { name: "Đổi mật khẩu" }), n: 3, pos: "bl" },
      { at: page.getByRole("button", { name: "Đăng xuất" }), n: 4, pos: "br" },
    ],
  });
}
