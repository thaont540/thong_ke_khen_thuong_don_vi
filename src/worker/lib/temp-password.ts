// No 0/O/1/l/I: the password is read off a screen and typed by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const TEMP_PASSWORD_LENGTH = 16;

/** Uniform random password (rejection sampling avoids modulo bias). */
export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}
