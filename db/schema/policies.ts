import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import type { Role } from "@/lib/auth/allowlist";
import { WRITE_ACTIONS, writeRoles, type WritableTable } from "@/lib/auth/permissions";

/** SQL that is true when the signed-in Supabase user has one of the roles. */
function hasRole(roles: Role[]) {
  const list = roles.map((role) => `'${role}'`).join(", ");
  return sql.raw(
    `exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in (${list}))`,
  );
}

/**
 * Row-level security for the Supabase client: everyone signed in reads, and
 * writes follow WRITE_RULES. Server code that connects through DATABASE_URL
 * is the table owner and bypasses these, so it must check canWrite itself.
 */
export function rolePolicies(table: WritableTable) {
  return [
    pgPolicy(`${table}_select`, {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    ...WRITE_ACTIONS.map((action) => {
      const check = hasRole(writeRoles(table, action));
      return pgPolicy(`${table}_${action}`, {
        for: action,
        to: authenticatedRole,
        using: action === "insert" ? undefined : check,
        withCheck: action === "delete" ? undefined : check,
      });
    }),
  ];
}

/** Read-only for everyone signed in; only database triggers write the table. */
export function readOnlyPolicies(table: string) {
  return [
    pgPolicy(`${table}_select`, {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ];
}
