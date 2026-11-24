export const ROLES = ["admin", "sales", "engineering", "supply"] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "sales";

export type AllowlistEntry = {
  email: string;
  role: Role;
};

/** Lowercases and trims an email so comparisons are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Parses ALLOWED_EMAILS into entries. Splits on commas, normalises each email
 * and reads an optional ":role" suffix.
 *
 * Format: "a@kern.example:admin, b@kern.example:sales, c@kern.example".
 * The role only seeds users.role on first login; after that the users table is
 * the source of truth. Malformed entries are dropped rather than allowed.
 */
export function parseAllowlist(raw: string | undefined): AllowlistEntry[] {
  if (!raw) return [];

  const entries: AllowlistEntry[] = [];
  for (const part of raw.split(",")) {
    const [emailPart, rolePart, ...rest] = part.split(":");
    const email = normalizeEmail(emailPart ?? "");
    const role = rolePart?.trim().toLowerCase();

    if (rest.length > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (role !== undefined && role !== "" && !isRole(role)) continue;

    entries.push({ email, role: role && isRole(role) ? role : DEFAULT_ROLE });
  }
  return entries;
}

/** Returns the allowlist entry for an email, or null when it is not allowed. */
export function findAllowedEntry(
  email: string | null | undefined,
  raw: string | undefined = process.env.ALLOWED_EMAILS,
): AllowlistEntry | null {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return parseAllowlist(raw).find((entry) => entry.email === normalized) ?? null;
}

/** Returns true when the email is on the ALLOWED_EMAILS allowlist. */
export function isEmailAllowed(
  email: string | null | undefined,
  raw: string | undefined = process.env.ALLOWED_EMAILS,
): boolean {
  return findAllowedEntry(email, raw) !== null;
}
