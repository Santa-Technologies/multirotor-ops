import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { companies, contacts } from "./customers";
import { pipedriveDealStatus } from "./enums";
import { rolePolicies } from "./policies";

/**
 * One-way mirror of Pipedrive deals. Linked to local companies/contacts when
 * org/person pipedrive ids match. Never written back to Pipedrive in phase 8.
 */
export const pipedriveDeals = pgTable(
  "pipedrive_deals",
  {
    ...auditColumns(),
    pipedriveId: integer().notNull().unique(),
    title: text().notNull(),
    status: pipedriveDealStatus().notNull().default("open"),
    /** Deal value in the deal's currency (decimal); display converts at the edge. */
    valueAmount: numeric({ precision: 14, scale: 2, mode: "number" }),
    currency: text().notNull().default("EUR"),
    pipelineId: integer(),
    pipelineName: text(),
    stageId: integer(),
    stageName: text(),
    orgPipedriveId: integer(),
    personPipedriveId: integer(),
    companyId: uuid().references(() => companies.id, { onDelete: "set null" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    expectedCloseDate: date(),
    syncedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.status),
    index().on(t.companyId),
    index().on(t.pipelineId),
    ...rolePolicies("pipedrive_deals"),
  ],
);
