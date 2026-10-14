import { app } from "./app";
import { cleanupExpiredSessions } from "./cron/cleanup-expired-sessions";

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      cleanupExpiredSessions(env.DB).then(
        (deleted) => console.log(`cron=${controller.cron}: removed ${deleted} expired sessions`),
        (err) => {
          console.error("cron cleanup failed", err);
          throw err;
        },
      ),
    );
  },
} satisfies ExportedHandler<Env>;
