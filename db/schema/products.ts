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

export const products = pgTable(
  "products",
  {
    ...auditColumns(),
    name: text().notNull().unique(),
    sku: text().unique(),
    pricingMode: pricingMode().notNull(),
    active: boolean().notNull().default(true),
  },
  () => rolePolicies("products"),
);

/** Volume price list; only used for list_price products. */
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
    // One current BOM version per product.
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
    mpn: text().notNull(),
    manufacturer: text(),
    description: text(),
    qtyPerBoard: integer().notNull(),
    designators: text(),
    sourcing: bomSourcing().notNull().default("distributor"),
    alternates: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    index().on(t.bomVersionId),
    index().on(t.mpn),
    check("bom_lines_qty_per_board_positive", sql`${t.qtyPerBoard} > 0`),
    ...rolePolicies("bom_lines"),
  ],
);
