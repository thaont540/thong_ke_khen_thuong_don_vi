import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/worker/app";
import { ORIGIN } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

interface FakeLimiter {
  keys: string[];
  limit(o: { key: string }): Promise<{ success: boolean }>;
}

const fakeLimiter = (verdict: (n: number) => boolean | Error): FakeLimiter => {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const v = verdict(keys.length);
      if (v instanceof Error) throw v;
      return { success: v };
    },
  };
};

const login = (limiter: FakeLimiter | undefined, headers: Record<string, string> = {}) =>
  Promise.resolve(
    app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ username: "admin1", password: TEST_PASSWORD }),
      },
      { ...env, LOGIN_LIMITER: limiter },
    ),
  );

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
});

describe("POST /api/auth/login per-IP throttle", () => {
  it("keys the limiter by CF-Connecting-IP and lets allowed requests through", async () => {
    const limiter = fakeLimiter(() => true);
    const res = await login(limiter, { "CF-Connecting-IP": "203.0.113.7" });
    expect(res.status).toBe(200);
    expect(limiter.keys).toEqual(["203.0.113.7"]);
  });

  it("answers 429 with Retry-After before touching the database", async () => {
    const limiter = fakeLimiter(() => false);
    const res = await login(limiter, { "CF-Connecting-IP": "203.0.113.7" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({
      code: "RATE_LIMITED",
      message: "Bạn thử quá nhiều lần, vui lòng đợi rồi thử lại",
    });
    expect(
      (await env.DB.prepare("SELECT COUNT(*) n FROM sessions").first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it("is skipped without the binding or without a client IP", async () => {
    expect((await login(undefined, { "CF-Connecting-IP": "203.0.113.7" })).status).toBe(200);
    const limiter = fakeLimiter(() => false);
    expect((await login(limiter)).status).toBe(200);
    expect(limiter.keys).toEqual([]);
  });

  it("fails open when the limiter itself errors", async () => {
    const limiter = fakeLimiter(() => new Error("limiter down"));
    const res = await login(limiter, { "CF-Connecting-IP": "203.0.113.7" });
    expect(res.status).toBe(200);
  });
});

describe("Cache-Control on /api", () => {
  it.each([
    ["/api/health", 200],
    ["/api/me", 401],
  ])("%s carries no-store (status %i)", async (path, status) => {
    const res = await app.request(path, {}, env);
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
