import { Hono } from "hono";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.all("/api/*", (c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "Internal error" } }, 500);
});
