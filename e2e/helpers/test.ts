import { test as base, expect } from "@playwright/test";
import { resetE2eData } from "./seed-e2e-database";

/**
 * Every spec starts from the seeded accounts only, and fails on uncaught page errors or CSP
 * violations (the production `_headers` policy is active under `vite preview`).
 */
export const test = base.extend<{ cleanSlate: void }>({
  cleanSlate: [
    async ({ page }, use) => {
      await resetE2eData();
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text());
      });
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
