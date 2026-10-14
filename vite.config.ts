import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// react() must come before cloudflare()
export default defineConfig({
  plugins: [react(), cloudflare()],
});
