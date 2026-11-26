import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { assemblyLotStatus } from "./enums";
import { rolePolicies } from "./policies";
import { parts, products } from "./products";

/**
 * Current stock picture for one shared part: on the shelf and on order.
 * One row per part; updates overwrite the previous quantities.
 */
export const partInventory = pgTable(
  "part_inventory",
  {
    ...auditColumns(),
    partId: uuid()
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    onHand: integer().notNull().default(0),
    onOrderQty: integer().notNull().default(0),
    /** Expected arrival for the on-order quantity. */
    eta: date(),
    poRef: text(),
    notes: text(),
  },
  (t) => [
    unique().on(t.partId),
    index().on(t.eta),
    check("part_inventory_on_hand_non_negative", sql`${t.onHand} >= 0`),
    check("part_inventory_on_order_non_negative", sql`${t.onOrderQty} >= 0`),
    ...rolePolicies("part_inventory"),
  ],
);

/** Finished-goods stock for one product variant. */
export const finishedGoods = pgTable(
  "finished_goods",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    qty: integer().notNull().default(0),
    notes: text(),
  },
  (t) => [
    unique().on(t.productId),
    check("finished_goods_qty_non_negative", sql`${t.qty} >= 0`),
    ...rolePolicies("finished_goods"),
  ],
);

/** A batch of boards being assembled or due from the assembler. */
export const assemblyLots = pgTable(
  "assembly_lots",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    qty: integer().notNull(),
    status: assemblyLotStatus().notNull().default("planned"),
    /** Target delivery / receipt date. */
    eta: date(),
    assembler: text(),
    notes: text(),
  },
  (t) => [
    index().on(t.productId),
    index().on(t.status),
    index().on(t.eta),
    check("assembly_lots_qty_positive", sql`${t.qty} > 0`),
    ...rolePolicies("assembly_lots"),
  ],
);
