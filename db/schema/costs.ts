import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { rolePolicies } from "./policies";
import { bomVersions, products } from "./products";
import { users } from "./users";

export const distributors = pgTable(
  "distributors",
  {
    ...auditColumns(),
    name: text().notNull().unique(),
    country: text(),
    // Only approved distributors count in cost runs (China-free, EU preferred).
    approved: boolean().notNull().default(false),
    apiProvider: text(),
  },
  () => rolePolicies("distributors"),
);

/** Raw distributor offer as fetched; append-only, enforced by a trigger. */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    ...auditColumns(),
    mpn: text().notNull(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id, { onDelete: "restrict" }),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Source currency as returned by the distributor; converted to EUR in the cost run.
    currency: text().notNull(),
    // Quantity → unit price in `currency`.
    priceBreaks: jsonb().$type<Record<string, number>>().notNull(),
    stock: integer(),
    factoryLeadDays: integer(),
    lifecycle: text(),
    url: text(),
  },
  (t) => [index().on(t.mpn, t.fetchedAt), ...rolePolicies("price_snapshots")],
);

/** Supplier quote for a direct-quote part (mpn) or for assembly (assembler). */
export const manualQuotes = pgTable(
  "manual_quotes",
  {
    ...auditColumns(),
    mpn: text(),
    assembler: text(),
    supplier: text().notNull(),
    qty: integer().notNull(),
    unitPriceCents: integer().notNull(),
    quotedAt: date().notNull(),
    validUntil: date(),
    sourceNote: text(),
    enteredBy: uuid().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index().on(t.mpn),
    check(
      "manual_quotes_mpn_or_assembler",
      sql`num_nonnulls(${t.mpn}, ${t.assembler}) = 1`,
    ),
    check("manual_quotes_qty_positive", sql`${t.qty} > 0`),
    check("manual_quotes_unit_price_non_negative", sql`${t.unitPriceCents} >= 0`),
    ...rolePolicies("manual_quotes"),
  ],
);

export const assemblyPrices = pgTable(
  "assembly_prices",
  {
    ...auditColumns(),
    assembler: text().notNull(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    qtyTier: integer().notNull(),
    unitPriceCents: integer().notNull(),
    setupCostCents: integer().notNull().default(0),
    quotedAt: date().notNull(),
    validUntil: date(),
  },
  (t) => [
    index().on(t.productId, t.qtyTier),
    check("assembly_prices_qty_tier_positive", sql`${t.qtyTier} > 0`),
    check(
      "assembly_prices_prices_non_negative",
      sql`${t.unitPriceCents} >= 0 and ${t.setupCostCents} >= 0`,
    ),
    ...rolePolicies("assembly_prices"),
  ],
);

export type CostRunTier = {
  materialCents: number;
  assemblyCents: number;
  totalCents: number;
};

/** One row per weekly cost calculation. */
export const costRuns = pgTable(
  "cost_runs",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    bomVersionId: uuid()
      .notNull()
      .references(() => bomVersions.id, { onDelete: "restrict" }),
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Board quantity → cost per board in euro cents.
    tiers: jsonb().$type<Record<string, CostRunTier>>().notNull(),
    flags: jsonb()
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    coveragePct: numeric({ precision: 5, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [index().on(t.productId, t.runAt), ...rolePolicies("cost_runs")],
);
