import { app } from "./app";

export default {
  fetch: app.fetch,
  // Phase 03+ wires the real nightly job; stub keeps the cron trigger valid.
  async scheduled(controller, _env, _ctx) {
    console.log(`scheduled run: cron=${controller.cron}`);
  },
} satisfies ExportedHandler<Env>;
