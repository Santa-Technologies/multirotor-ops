import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { rolePolicies } from "./policies";

export const companies = pgTable(
  "companies",
  {
    ...auditColumns(),
    name: text().notNull(),
    country: text(),
    website: text(),
    pipedriveId: integer().unique(),
  },
  () => rolePolicies("companies"),
);

export const contacts = pgTable(
  "contacts",
  {
    ...auditColumns(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: text(),
    phone: text(),
    linkedinUrl: text(),
    pipedriveId: integer().unique(),
  },
  (t) => [index().on(t.companyId), ...rolePolicies("contacts")],
);
