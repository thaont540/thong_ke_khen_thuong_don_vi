/** F03 add-award form: personal, collective, medal, validation errors and duplicate warning. */
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";

const TEAM_6_1 = "Đội CSGT đường bộ cao tốc số 1";

/** Officer labels append rank and badge, so pick by the name they contain. */
async function pickOfficer(select: Locator, name: string): Promise<void> {
  const value = await select.locator("option", { hasText: name }).first().getAttribute("value");
  if (value === null) throw new Error(`No officer option containing "${name}"`);
  await select.selectOption(value);
}

async function openForm(page: Page): Promise<void> {
  await page.goto("/awards/new");
  await expect(page.locator("#a-unit")).toBeVisible();
  await expect(page.locator("#a-authority")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function fillDecision(page: Page, decision: string): Promise<void> {
  await page.locator("#a-decision").fill(decision);
  await page.locator("#a-date").fill("2026-10-10");
  await page.locator("#a-details").fill("Hoàn thành xuất sắc nhiệm vụ năm 2026");
}

const radios = (page: Page, name: string) => page.getByRole("radiogroup", { name });

export async function capturePersonalForm(page: Page): Promise<void> {
  await openForm(page);
  await page.locator("#a-unit").selectOption({ label: "Phòng 6" });
  await page.locator("#a-team").selectOption({ label: "Đội CSGT đường bộ cao tốc số 2" });
  await pickOfficer(page.locator("#a-officer"), "Phạm Thanh Tùng");
  await page.locator("#a-award").selectOption({ label: "Chiến sĩ thi đua cơ sở" });
  await expect(page.locator("#a-authority")).toHaveValue(/\d+/);
  await fillDecision(page, "150/QĐ-P6");
  await page.locator("#a-note").fill("Đề nghị của Đội CSGT đường bộ cao tốc số 2");
  await expect(page.locator(".person-card")).toContainText("Phạm Thanh Tùng");
  await shot(page, {
    name: "13-add-personal",
    fullPage: true,
    callouts: [
      { at: radios(page, "Đối tượng"), n: 1 },
      { at: page.locator("#a-unit"), n: 2 },
      { at: page.locator("#a-team"), n: 3 },
      { at: page.locator("#a-officer"), n: 4 },
      { at: page.locator(".person-card"), n: 5 },
      { at: radios(page, "Hình thức"), n: 6 },
      { at: page.locator("#a-award"), n: 7 },
      { at: page.locator("#a-year"), n: 8 },
      { at: page.locator("#a-decision"), n: 9 },
      { at: page.locator("#a-date"), n: 10 },
      { at: page.locator("#a-authority"), n: 11 },
      { at: page.locator("#a-details"), n: 12 },
      { at: page.locator("#a-note"), n: 13 },
      { at: page.getByRole("button", { name: "Xóa nội dung" }), n: 14, pos: "tl" },
      { at: page.getByRole("button", { name: "Lưu và thêm tiếp" }), n: 15, pos: "tl" },
      { at: page.getByRole("button", { name: "Lưu khen thưởng" }), n: 16, pos: "tr" },
    ],
  });
}

export async function captureCollectiveForm(page: Page): Promise<void> {
  await openForm(page);
  await page.locator('input[name="a-subject"][value="TAP_THE"]').check();
  await page.locator("#a-unit").selectOption({ label: "Phòng 7" });
  await page.locator("#a-team").selectOption({ label: "Đội Dẫn đoàn số 1" });
  await page.locator("#a-award").selectOption({ label: "Đơn vị tiên tiến" });
  await expect(page.locator("#a-officer")).toHaveCount(0);
  await shot(page, {
    name: "14-add-collective",
    height: 760,
    callouts: [
      { at: radios(page, "Đối tượng"), n: 1 },
      { at: page.locator("#a-unit"), n: 2 },
      { at: page.locator("#a-team"), n: 3 },
      { at: page.locator("#a-award"), n: 4 },
    ],
  });
}

export async function captureMedalForm(page: Page): Promise<void> {
  await openForm(page);
  await page.locator('input[name="a-form"][value="KHEN_THUONG"]').check();
  await page.locator("#a-award").selectOption({ label: "Huân chương" });
  await expect(page.locator("#a-medal")).toBeVisible();
  await page.locator("#a-medal").selectOption({ label: "Huân chương Chiến công hạng Ba" });
  await expect(page.locator("#a-authority option:checked")).toHaveText("Chủ tịch nước");
  await shot(page, {
    name: "15-add-medal",
    height: 1000,
    callouts: [
      { at: radios(page, "Hình thức"), n: 1 },
      { at: page.locator("#a-award"), n: 2 },
      { at: page.locator("#a-medal"), n: 3 },
      { at: page.locator("#a-authority"), n: 4 },
    ],
  });
}

export async function captureValidationErrors(page: Page): Promise<void> {
  await openForm(page);
  await page.getByRole("button", { name: "Lưu khen thưởng" }).click();
  await expect(page.locator("#a-unit-error")).toBeVisible();
  const err = (id: string) => ({ at: page.locator(`#${id}-error`), pos: "ir" as const });
  await shot(page, {
    name: "16-add-validation-errors",
    fullPage: true,
    callouts: [
      { ...err("a-unit"), n: 1 },
      { ...err("a-officer"), n: 2 },
      { ...err("a-award"), n: 3 },
      { ...err("a-decision"), n: 4 },
      { ...err("a-date"), n: 5 },
      { ...err("a-authority"), n: 6 },
      { ...err("a-details"), n: 7 },
    ],
  });
}

export async function captureDuplicateWarning(page: Page): Promise<void> {
  await openForm(page);
  await page.locator("#a-unit").selectOption({ label: "Phòng 6" });
  await page.locator("#a-team").selectOption({ label: TEAM_6_1 });
  await pickOfficer(page.locator("#a-officer"), "Nguyễn Văn Hùng");
  await page.locator("#a-award").selectOption({ label: "Chiến sĩ thi đua cơ sở" });
  await fillDecision(page, "151/QĐ-P6");
  await page.getByRole("button", { name: "Lưu khen thưởng" }).click();
  const dialog = page.getByRole("dialog", { name: "Có thể bị trùng" });
  await expect(dialog).toContainText("125/QĐ-P6");
  await shot(page, {
    name: "19-duplicate-warning",
    callouts: [
      { at: dialog.locator(".confirm-text"), n: 1 },
      { at: dialog.getByRole("button", { name: "Hủy" }), n: 2, pos: "tl" },
      { at: dialog.getByRole("button", { name: "Vẫn lưu" }), n: 3, pos: "tr" },
    ],
  });
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
}

/** F03 third form "Xếp loại cán bộ": only for Cá nhân, one rating per officer per year. */
export async function captureRatingForm(page: Page): Promise<void> {
  await openForm(page);
  await page.locator("#a-unit").selectOption({ label: "Phòng 6" });
  await pickOfficer(page.locator("#a-officer"), "Hoàng Đức Long");
  await page.locator('input[name="a-form"][value="XEP_LOAI"]').check();
  await page.locator("#a-award").selectOption({ label: "Hoàn thành tốt nhiệm vụ" });
  await expect(page.locator("#a-authority option:checked")).toHaveText("Cục trưởng Cục CSGT");
  await fillDecision(page, "09/QĐ-C08");
  await page.locator("#a-details").fill("Xếp loại cán bộ năm 2026");
  await shot(page, {
    name: "41-add-rating",
    fullPage: true,
    callouts: [
      { at: page.locator("#a-officer"), n: 1 },
      { at: radios(page, "Hình thức"), n: 2 },
      { at: page.locator("#a-award"), n: 3 },
      { at: page.locator("#a-year"), n: 4 },
      { at: page.locator("#a-authority"), n: 5 },
    ],
  });
}
