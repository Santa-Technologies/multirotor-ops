import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

import { ROLES } from "@/lib/auth/allowlist";

export const userRole = pgEnum("user_role", ROLES);

// RLS is enabled with no policies, so the public Supabase key cannot read or
// write this table through the REST API. Server code connects as the database
// owner via DATABASE_URL. Per-role policies arrive in phase 1.
export const users = pgTable("users", {
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
}).enableRLS();

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
