import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { activityAction } from "./enums";
import { readOnlyPolicies } from "./policies";

/**
 * Audit trail written by the log_activity trigger (drizzle/0002) on every
 * insert, update and delete; append-only. user_id and created_by have no
 * foreign key so entries survive the deletion of the user they name.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    action: activityAction().notNull(),
    userId: uuid(),
    // Insert and delete: the whole row. Update: { column: { old, new } } for changed columns.
    diff: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    index().on(t.entity, t.entityId),
    index().on(t.createdAt),
    ...readOnlyPolicies("activity_log"),
  ],
);
