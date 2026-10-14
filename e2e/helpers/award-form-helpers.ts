import { expect, type Locator, type Page } from "@playwright/test";

/** Selects the option whose text contains `text` (officer labels append rank and badge). */
export async function selectOptionContaining(select: Locator, text: string): Promise<void> {
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  if (value === null) throw new Error(`No option containing "${text}"`);
  await select.selectOption(value);
}

export interface PersonalAwardInput {
  unit: string;
  team?: string;
  officer: string;
  decision: string;
}

/** Fills F03 for a personal "Chiến sĩ thi đua cơ sở" (the form defaults to Cá nhân + Danh hiệu). */
export async function fillPersonalAwardForm(page: Page, a: PersonalAwardInput): Promise<void> {
  await page.locator("#a-unit").selectOption({ label: a.unit });
  if (a.team) await page.locator("#a-team").selectOption({ label: a.team });
  await selectOptionContaining(page.locator("#a-officer"), a.officer);
  await page.locator("#a-award").selectOption({ label: "Chiến sĩ thi đua cơ sở" });
  await page.locator("#a-decision").fill(a.decision);
  await page.locator("#a-date").fill("2026-05-01");
  await expect(page.locator("#a-authority")).toHaveValue(/\d+/); // defaulted from the type
  await page.locator("#a-details").fill("Hoàn thành xuất sắc nhiệm vụ");
}
