import { defineConfig, devices } from "@playwright/test";
import { E2E_STATE_DIR } from "./e2e/helpers/seed-e2e-database";

const PORT = 5180;

/**
 * Smoke flows against the production build served by `vite preview` (real Worker + local D1 in a
 * throwaway state dir, real `_headers` CSP). One worker: specs share the single database and each
 * resets it in beforeEach.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx e2e/helpers/seed-e2e-database.ts && npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { E2E_STATE_DIR },
  },
});
