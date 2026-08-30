const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?-+";

function pick(pool: string): string {
  const [byte] = crypto.getRandomValues(new Uint8Array(1));
  return pool[byte! % pool.length]!;
}

/** A strong, readable password containing all four character classes. */
export function generatePassword(length = 16): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates shuffle with cryptographic randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    const j = byte! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Returns an error message when the password is too weak, otherwise null. */
export function validatePassword(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  if (classes < 3)
    return "Mix at least three of: lowercase, uppercase, digits, symbols";
  return null;
}
