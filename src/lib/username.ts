/**
 * Usernames are the primary identity in SplitTrip. They are a single word:
 * letters (any language), digits, period, underscore and hyphen — no whitespace.
 *
 * Auth still needs an address-shaped identifier, so every username maps
 * deterministically to a synthetic, ASCII-safe internal address. It is never
 * shown to users and never receives mail.
 */

export const USERNAME_DOMAIN = "splittrip.local";
export const USERNAME_PATTERN = /^[\p{L}\p{N}._-]{2,32}$/u;

export function normalizeUsername(input: string): string {
  return input.trim().normalize("NFC");
}

export function validateUsername(input: string): string | null {
  const name = normalizeUsername(input);
  if (!name) return "Pick a username";
  if (/\s/u.test(name)) return "The username can't contain spaces";
  if (name.length < 2) return "The username is too short";
  if (name.length > 32) return "The username is too long (max 32 characters)";
  if (!USERNAME_PATTERN.test(name))
    return "Use letters, digits, period, underscore or hyphen only";
  return null;
}

/** Deterministic ASCII-safe internal address for a username. */
export function usernameToEmail(input: string): string {
  const name = normalizeUsername(input).toLowerCase();
  let encoded = "";
  for (const ch of name) {
    if (/[a-z0-9]/.test(ch)) encoded += ch;
    else if (ch === "-") encoded += "-h-";
    else if (ch === ".") encoded += "-d-";
    else if (ch === "_") encoded += "-u-";
    else encoded += `-x${ch.codePointAt(0)!.toString(16)}-`;
  }
  return `u${encoded}@${USERNAME_DOMAIN}`;
}
