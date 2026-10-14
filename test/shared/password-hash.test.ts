import { describe, expect, it } from "vitest";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  verifyPassword,
} from "../../src/worker/lib/password-hash";

describe("password-hash", () => {
  it("round-trips and uses the documented format", async () => {
    const hash = await hashPassword("Password-12345");
    expect(hash).toMatch(/^pbkdf2\$sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("Password-12345", hash)).toEqual({ ok: true, needsRehash: false });
  });

  it("rejects the wrong password and uses a random salt", async () => {
    const a = await hashPassword("secret-value-1", 1000);
    const b = await hashPassword("secret-value-1", 1000);
    expect(a).not.toBe(b);
    expect((await verifyPassword("secret-value-2", a)).ok).toBe(false);
  });

  it("rejects a tampered salt or hash", async () => {
    const [p, a, n, salt, hash] = (await hashPassword("secret-value-1", 1000)).split("$");
    const flip = (s: string) => `${s[0] === "A" ? "B" : "A"}${s.slice(1)}`;
    expect(
      (await verifyPassword("secret-value-1", [p, a, n, flip(salt as string), hash].join("$"))).ok,
    ).toBe(false);
    expect(
      (await verifyPassword("secret-value-1", [p, a, n, salt, flip(hash as string)].join("$"))).ok,
    ).toBe(false);
  });

  it("reads iterations from the string and flags a rehash when below the constant", async () => {
    const old = await hashPassword("secret-value-1", 1000);
    expect(await verifyPassword("secret-value-1", old)).toEqual({ ok: true, needsRehash: true });
    expect(PBKDF2_ITERATIONS).toBe(100_000);
  });

  it.each([
    "",
    "plain-text",
    "pbkdf2$sha256$abc$AAAA$AAAA",
    "pbkdf2$sha1$1000$AAAA$AAAA",
    "pbkdf2$sha256$0$AAAA$AAAA",
    "pbkdf2$sha256$100001$AAAA$AAAA",
    "pbkdf2$sha256$1000$AAAA",
  ])("never throws on malformed stored value %j", async (stored) => {
    expect(await verifyPassword("x", stored)).toEqual({ ok: false, needsRehash: false });
  });
});
