import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// E2E_STATE_DIR points the local D1 at a throwaway directory so `npm run test:e2e` never touches
// the developer's own `.wrangler/state` (see playwright.config.ts).
const stateDir = process.env.E2E_STATE_DIR;

// react() must come before cloudflare()
export default defineConfig({
  plugins: [react(), cloudflare(stateDir ? { persistState: { path: stateDir } } : {})],
});
