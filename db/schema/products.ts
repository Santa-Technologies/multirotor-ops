import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { bomSourcing, pricingMode } from "./enums";
import { rolePolicies } from "./policies";

/** Family of boards (Pilot H743, CoPilot Nano, …). Variants hang off this. */
export const productLines = pgTable(
  "product_lines",
  {
    ...auditColumns(),
    name: text().notNull().unique(),
    description: text(),
    active: boolean().notNull().default(true),
  },
  () => rolePolicies("product_lines"),
);

/**
 * Shared component identity. BOM lines reference this so the same MPN is not
 * duplicated across Pilot and CoPilot BOMs.
 */
export const parts = pgTable(
  "parts",
  {
    ...auditColumns(),
    mpn: text().notNull(),
    manufacturer: text(),
    description: text(),
    defaultSourcing: bomSourcing().notNull().default("distributor"),
  },
  (t) => [
    uniqueIndex("parts_mpn_lower").on(sql`lower(${t.mpn})`),
    index().on(t.manufacturer),
    ...rolePolicies("parts"),
  ],
);

/**
 * A sellable / buildable variant under a product line (e.g. Pilot H743 · Standard).
 * Quotes, cost runs and BOM versions still FK here.
 */
export const products = pgTable(
  "products",
  {
    ...auditColumns(),
    productLineId: uuid()
      .notNull()
      .references(() => productLines.id, { onDelete: "restrict" }),
    // Unique display name used in UI and quote text (e.g. "Pilot H743").
    name: text().notNull().unique(),
    // Label within the line (Standard, Alt IMU, …).
    variantLabel: text().notNull().default("Standard"),
    sku: text().unique(),
    pricingMode: pricingMode().notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [
    unique().on(t.productLineId, t.variantLabel),
    index().on(t.productLineId),
    ...rolePolicies("products"),
  ],
);

/** Volume price list; only used for list_price variants. */
export const listPrices = pgTable(
  "list_prices",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    minQty: integer().notNull(),
    unitPriceCents: integer().notNull(),
  },
  (t) => [
    unique().on(t.productId, t.minQty),
    check("list_prices_min_qty_positive", sql`${t.minQty} > 0`),
    check("list_prices_unit_price_non_negative", sql`${t.unitPriceCents} >= 0`),
    ...rolePolicies("list_prices"),
  ],
);

export const bomVersions = pgTable(
  "bom_versions",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text().notNull(),
    isCurrent: boolean().notNull().default(false),
    notes: text(),
  },
  (t) => [
    unique().on(t.productId, t.version),
    // One current BOM version per variant.
    uniqueIndex("bom_versions_one_current_per_product")
      .on(t.productId)
      .where(sql`${t.isCurrent}`),
    ...rolePolicies("bom_versions"),
  ],
);

export const bomLines = pgTable(
  "bom_lines",
  {
    ...auditColumns(),
    bomVersionId: uuid()
      .notNull()
      .references(() => bomVersions.id, { onDelete: "cascade" }),
    partId: uuid()
      .notNull()
      .references(() => parts.id, { onDelete: "restrict" }),
    qtyPerBoard: integer().notNull(),
    designators: text(),
    sourcing: bomSourcing().notNull().default("distributor"),
    // Alternate MPNs as text; resolved to parts when priced.
    alternates: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    index().on(t.bomVersionId),
    index().on(t.partId),
    check("bom_lines_qty_per_board_positive", sql`${t.qtyPerBoard} > 0`),
    ...rolePolicies("bom_lines"),
  ],
);
