import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { companies } from "./customers";
import {
  salesDocumentKind,
  salesInvoiceStatus,
  salesOrderStatus,
  salesShipmentStatus,
} from "./enums";
import { pipedriveDeals } from "./pipedrive";
import { rolePolicies } from "./policies";
import { products } from "./products";
import { quotes } from "./quotes";
import { users } from "./users";

/**
 * Deal-centric commercial order. Intent is the first step; quote calculation
 * stays in the pricing engine. External PDFs are logged via sales_documents.
 */
export const salesOrders = pgTable(
  "sales_orders",
  {
    ...auditColumns(),
    dealId: uuid().references(() => pipedriveDeals.id, { onDelete: "set null" }),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    quoteId: uuid().references(() => quotes.id, { onDelete: "set null" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    qty: integer(),
    status: salesOrderStatus().notNull().default("intent"),
    notes: text(),
    orderedAt: date(),
    shippedAt: date(),
  },
  (t) => [
    index().on(t.dealId),
    index().on(t.companyId),
    index().on(t.status),
    check("sales_orders_qty_positive", sql`${t.qty} is null or ${t.qty} > 0`),
    ...rolePolicies("sales_orders"),
  ],
);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    ...auditColumns(),
    orderId: uuid()
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    externalNumber: text(),
    amountCents: integer().notNull(),
    currency: text().notNull().default("EUR"),
    status: salesInvoiceStatus().notNull().default("draft"),
    paidAt: timestamp({ withTimezone: true }),
    pdfUrl: text(),
    pdfStoragePath: text(),
  },
  (t) => [
    index().on(t.orderId),
    index().on(t.status),
    check("sales_invoices_amount_non_negative", sql`${t.amountCents} >= 0`),
    ...rolePolicies("sales_invoices"),
  ],
);

/** Polymorphic attach for external quote/invoice PDFs (metadata only). */
export const salesDocuments = pgTable(
  "sales_documents",
  {
    ...auditColumns(),
    kind: salesDocumentKind().notNull().default("other"),
    orderId: uuid().references(() => salesOrders.id, { onDelete: "cascade" }),
    quoteId: uuid().references(() => quotes.id, { onDelete: "cascade" }),
    filename: text().notNull(),
    url: text(),
    storagePath: text(),
    uploadedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index().on(t.orderId),
    index().on(t.quoteId),
    check(
      "sales_documents_parent",
      sql`num_nonnulls(${t.orderId}, ${t.quoteId}) >= 1`,
    ),
    ...rolePolicies("sales_documents"),
  ],
);

export const salesShipments = pgTable(
  "sales_shipments",
  {
    ...auditColumns(),
    orderId: uuid()
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    status: salesShipmentStatus().notNull().default("not_ready"),
    tracking: text(),
    eta: date(),
    notes: text(),
    shippedAt: date(),
  },
  (t) => [
    index().on(t.orderId),
    index().on(t.status),
    ...rolePolicies("sales_shipments"),
  ],
);
