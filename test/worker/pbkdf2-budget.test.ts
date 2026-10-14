import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, createSession } from "./helpers/auth-helpers";
import { insertUser, resetTestData, TEST_PASSWORD } from "./helpers/test-fixtures";

/** Free-plan CPU rule: at most 2 PBKDF2 derivations per request. */
let derivations: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  await resetTestData(env.DB);
  await insertUser(env.DB, { id: 1, username: "admin1" });
  await insertUser(env.DB, { id: 2, username: "editor1", role: "EDITOR" });
  await env.DB.prepare("UPDATE users SET must_change_password = 0").run();
  derivations = vi.spyOn(crypto.subtle, "deriveBits");
});
afterEach(() => derivations.mockRestore());

const used = () => derivations.mock.calls.length;

describe("PBKDF2 budget", () => {
  it("login: 1 derivation for a known user, 1 for an unknown user", async () => {
    await api("/api/auth/login", { body: { username: "admin1", password: TEST_PASSWORD } });
    expect(used()).toBe(1);
    derivations.mockClear();
    await api("/api/auth/login", { body: { username: "ghost", password: "whatever-pass" } });
    expect(used()).toBe(1);
  });

  it("change-password: 2, reset-password: 1, create user: 1, authed read: 0", async () => {
    const token = await createSession(env.DB, 1);
    await api("/api/auth/change-password", {
      token,
      body: {
        current_password: TEST_PASSWORD,
        new_password: "Another-pass-1",
        confirm_password: "Another-pass-1",
      },
    });
    expect(used()).toBe(2);
    derivations.mockClear();
    await api("/api/users/2/reset-password", { method: "POST", token });
    expect(used()).toBe(1);
    derivations.mockClear();
    await api("/api/users", {
      token,
      body: {
        username: "newuser",
        full_name: "N",
        role: "VIEWER",
        temp_password: "Temp-pass-12345",
      },
    });
    expect(used()).toBe(1);
    derivations.mockClear();
    await api("/api/users", { token });
    expect(used()).toBe(0);
  });
});
