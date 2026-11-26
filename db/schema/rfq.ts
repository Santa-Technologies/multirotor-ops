import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { rfqOfferStatus, rfqThreadStatus } from "./enums";
import { rolePolicies } from "./policies";
import { parts } from "./products";

/** Direct-quote supplier (email RFQ target), separate from API distributors. */
export const suppliers = pgTable(
  "suppliers",
  {
    ...auditColumns(),
    name: text().notNull(),
    email: text().notNull(),
    notes: text(),
    active: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex("suppliers_email_lower").on(sql`lower(${t.email})`),
    unique().on(t.name),
    ...rolePolicies("suppliers"),
  ],
);

/** Preferred suppliers for a part (used when opening an RFQ). */
export const partSuppliers = pgTable(
  "part_suppliers",
  {
    ...auditColumns(),
    partId: uuid()
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    supplierId: uuid()
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    preferred: boolean().notNull().default(false),
    notes: text(),
  },
  (t) => [
    unique().on(t.partId, t.supplierId),
    index().on(t.supplierId),
    ...rolePolicies("part_suppliers"),
  ],
);

/**
 * One RFQ conversation for a part. Deduped: at most one open thread per part
 * (sent / awaiting_reply / offer_received).
 */
export const rfqThreads = pgTable(
  "rfq_threads",
  {
    ...auditColumns(),
    partId: uuid()
      .notNull()
      .references(() => parts.id, { onDelete: "restrict" }),
    supplierId: uuid()
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    status: rfqThreadStatus().notNull().default("draft"),
    /** Short token embedded in the subject for inbound matching, e.g. RFQ-A1B2. */
    subjectToken: text().notNull(),
    qtyRequested: integer().notNull(),
    outboundResendId: text(),
    outboundMessageId: text(),
    lastInboundEmailId: text(),
    lastInboundMessageId: text(),
    sentAt: date(),
    notes: text(),
  },
  (t) => [
    unique().on(t.subjectToken),
    index().on(t.partId, t.status),
    index().on(t.supplierId),
    check("rfq_threads_qty_positive", sql`${t.qtyRequested} > 0`),
    ...rolePolicies("rfq_threads"),
  ],
);

/**
 * LLM-parsed offer draft (or manually entered). Confirmed rows write
 * `manual_quotes`; never auto-write from parse alone.
 */
export const rfqOffers = pgTable(
  "rfq_offers",
  {
    ...auditColumns(),
    rfqThreadId: uuid()
      .notNull()
      .references(() => rfqThreads.id, { onDelete: "cascade" }),
    status: rfqOfferStatus().notNull().default("pending_confirm"),
    sourceFilename: text(),
    inboundEmailId: text(),
    /** Full model extract for audit; human may edit the typed fields below. */
    extractJson: jsonb().$type<Record<string, unknown>>(),
    qty: integer(),
    unitPriceCents: integer(),
    currency: text().notNull().default("EUR"),
    stock: integer(),
    validUntil: date(),
    leadDays: integer(),
    parseNotes: text(),
    confirmedManualQuoteId: uuid(),
  },
  (t) => [
    index().on(t.rfqThreadId, t.status),
    check(
      "rfq_offers_qty_positive",
      sql`${t.qty} is null or ${t.qty} > 0`,
    ),
    check(
      "rfq_offers_unit_price_non_negative",
      sql`${t.unitPriceCents} is null or ${t.unitPriceCents} >= 0`,
    ),
    ...rolePolicies("rfq_offers"),
  ],
);
