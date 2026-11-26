import type { Role } from "@/lib/auth/allowlist";

export const WRITE_ACTIONS = ["insert", "update", "delete"] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

type WriteRules = Record<WriteAction, readonly Role[]>;

/** Gives the same roles every write action on a table. */
const all = (...roles: Role[]): WriteRules => ({
  insert: roles,
  update: roles,
  delete: roles,
});

/**
 * Which roles besides admin may write each table. Everyone signed in may read
 * every table. This single matrix generates the row-level security policies
 * (db/schema/policies.ts) and the server-side checks (canWrite), so the two
 * cannot drift apart.
 */
export const WRITE_RULES = {
  users: all(),
  companies: all("sales"),
  contacts: all("sales"),
  // Sales logs requests; engineering triages them (status, owner, requirement).
  requests: { insert: ["sales"], update: ["sales", "engineering"], delete: ["sales"] },
  requirements: all("engineering"),
  product_lines: all("engineering"),
  products: all("engineering"),
  parts: all("engineering"),
  list_prices: all("engineering"),
  bom_versions: all("engineering"),
  bom_lines: all("engineering"),
  distributors: all(),
  // Append-only; a trigger rejects updates and deletes for everyone.
  price_snapshots: all(),
  manual_quotes: all("supply"),
  assembly_prices: all("supply"),
  cost_runs: all(),
  quote_settings: all(),
  quotes: all("sales"),
} as const satisfies Record<string, WriteRules>;

export type WritableTable = keyof typeof WRITE_RULES;

/** Roles allowed to perform an action on a table; admin may always write. */
export function writeRoles(table: WritableTable, action: WriteAction): Role[] {
  return ["admin", ...WRITE_RULES[table][action]];
}

/** Whether a role may perform a write action on a table. */
export function canWrite(role: Role, table: WritableTable, action: WriteAction): boolean {
  return writeRoles(table, action).includes(role);
}
