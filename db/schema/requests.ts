import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { companies, contacts } from "./customers";
import {
  requestStatus,
  requestType,
  requestUrgency,
  requirementStatus,
  sourceChannel,
} from "./enums";
import { pipedriveDeals } from "./pipedrive";
import { rolePolicies } from "./policies";
import { products } from "./products";
import { users } from "./users";

/** Groups many requests; the number of linked requests is the demand signal. */
export const requirements = pgTable(
  "requirements",
  {
    ...auditColumns(),
    title: text().notNull(),
    description: text(),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    status: requirementStatus().notNull().default("open"),
    roadmapRef: text(),
  },
  () => rolePolicies("requirements"),
);

export const requests = pgTable(
  "requests",
  {
    ...auditColumns(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    sourceChannel: sourceChannel(),
    // The phase 4 quick-add requires a one-line summary alongside the raw message.
    summary: text().notNull(),
    // The original LinkedIn or Signal message, exactly as pasted.
    rawText: text(),
    type: requestType().notNull(),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    quantity: integer(),
    urgency: requestUrgency(),
    status: requestStatus().notNull().default("new"),
    ownerId: uuid().references(() => users.id, { onDelete: "set null" }),
    requirementId: uuid().references(() => requirements.id, { onDelete: "set null" }),
    dueDate: date(),
    /** Pipedrive deal id (int) for PD API notes; prefer `dealId` for joins. */
    pipedriveDealId: integer(),
    /** Soft FK to mirrored deal row. */
    dealId: uuid().references(() => pipedriveDeals.id, { onDelete: "set null" }),
  },
  (t) => [
    index().on(t.companyId),
    index().on(t.status),
    index().on(t.requirementId),
    index().on(t.ownerId),
    index().on(t.pipedriveDealId),
    index().on(t.dealId),
    check("requests_quantity_positive", sql`${t.quantity} > 0`),
    ...rolePolicies("requests"),
  ],
);
