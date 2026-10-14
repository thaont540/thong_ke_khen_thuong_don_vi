/** Largest iteration count workerd accepts for PBKDF2 (phase-01 Spike C). */
export const PBKDF2_ITERATIONS = 100_000;

const HASH_BYTES = 32;
const SALT_BYTES = 16;
const FORMAT = /^pbkdf2\$sha256\$(\d{1,7})\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

/** `crypto.subtle.timingSafeEqual` exists in workerd only; typed locally so Node scripts compile. */
interface SubtleWithTimingSafeEqual {
  timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
}

export interface VerifyResult {
  ok: boolean;
  /** True when the stored hash uses fewer iterations than PBKDF2_ITERATIONS. */
  needsRehash: boolean;
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  const native = (crypto.subtle as unknown as SubtleWithTimingSafeEqual).timingSafeEqual;
  if (native) return native.call(crypto.subtle, a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Returns `pbkdf2$sha256$<N>$<salt b64>$<hash b64>`; exactly one derivation. */
export async function hashPassword(
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Reads N from the stored string. Malformed or unsupported strings never throw: ok=false. */
export async function verifyPassword(password: string, stored: string): Promise<VerifyResult> {
  const m = FORMAT.exec(stored);
  const iterations = m ? Number(m[1]) : 0;
  if (!m || iterations < 1 || iterations > PBKDF2_ITERATIONS) {
    return { ok: false, needsRehash: false };
  }
  try {
    const expected = fromBase64(m[3] as string);
    const actual = await derive(password, fromBase64(m[2] as string), iterations);
    return {
      ok: constantTimeEqual(actual, expected),
      needsRehash: iterations < PBKDF2_ITERATIONS,
    };
  } catch {
    return { ok: false, needsRehash: false };
  }
}
