import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

import { userRole } from "./enums";
import { rolePolicies } from "./policies";

export const users = pgTable(
  "users",
  {
    // Same id as the Supabase Auth user, so a session maps to exactly one row.
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: text().notNull().unique(),
    role: userRole().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid(),
  },
  () => rolePolicies("users"),
).enableRLS();

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
