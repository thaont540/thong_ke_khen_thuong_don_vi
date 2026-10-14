import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanupExpiredSessions } from "../../src/worker/cron/cleanup-expired-sessions";
import worker from "../../src/worker/index";
import { createSession, sessionCount } from "./helpers/auth-helpers";
import { insertUser, resetTestData } from "./helpers/test-fixtures";

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
});

describe("cron cleanup", () => {
  it("removes expired sessions and keeps active ones", async () => {
    await createSession(env.DB, 1, { expiresInSeconds: -60 });
    await createSession(env.DB, 1, { expiresInSeconds: -86400 });
    await createSession(env.DB, 1, { expiresInSeconds: 3600 });
    expect(await cleanupExpiredSessions(env.DB)).toBe(2);
    expect(await sessionCount(env.DB)).toBe(1);
  });

  it("the scheduled handler runs the cleanup", async () => {
    await createSession(env.DB, 1, { expiresInSeconds: -60 });
    const pending: Promise<unknown>[] = [];
    await worker.scheduled(
      {
        cron: "0 17 * * *",
        scheduledTime: Date.now(),
        type: "scheduled",
        noRetry() {},
      } as ScheduledController,
      env,
      {
        waitUntil: (p: Promise<unknown>) => void pending.push(p),
        passThroughOnException() {},
      } as ExecutionContext,
    );
    await Promise.all(pending);
    expect(await sessionCount(env.DB)).toBe(0);
  });
});
