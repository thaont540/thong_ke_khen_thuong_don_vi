import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../../src/worker/app";

describe("app", () => {
  it("GET /api/health", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("unknown /api/* is JSON 404", async () => {
    const res = await app.request("/api/nope", {}, env);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
