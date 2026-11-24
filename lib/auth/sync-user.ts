import "server-only";

import { getDb } from "@/db";
import { users } from "@/db/schema";

import type { AllowlistEntry } from "./allowlist";

/** Turns "nils.example@kern.example" into "Nils Example" as a placeholder display name. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Creates the users row on first login. An existing row is left untouched,
 * because after the first login the users table, not the env allowlist, owns
 * the role and name.
 */
export async function ensureUserRow(authUserId: string, entry: AllowlistEntry) {
  await getDb()
    .insert(users)
    .values({
      id: authUserId,
      email: entry.email,
      name: nameFromEmail(entry.email),
      role: entry.role,
    })
    .onConflictDoNothing({ target: users.id });
}
