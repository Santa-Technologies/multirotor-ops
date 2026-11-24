import { timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Columns every table carries. Triggers (drizzle/0002) set created_by from the
 * acting user on insert and bump updated_at on every update.
 */
export function auditColumns() {
  return {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  };
}
