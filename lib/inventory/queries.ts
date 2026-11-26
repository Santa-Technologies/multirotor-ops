import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  assemblyLots,
  finishedGoods,
  partInventory,
  parts,
  products,
} from "@/db/schema";

/** Parts stock rows joined to the parts catalog (including parts with no row yet). */
export async function listPartStock() {
  const db = getDb();
  return db
    .select({
      part: parts,
      inventory: partInventory,
    })
    .from(parts)
    .leftJoin(partInventory, eq(partInventory.partId, parts.id))
    .orderBy(asc(parts.mpn));
}

/** Finished-goods stock per active variant. */
export async function listFinishedGoodsStock() {
  const db = getDb();
  return db
    .select({
      product: products,
      stock: finishedGoods,
    })
    .from(products)
    .leftJoin(finishedGoods, eq(finishedGoods.productId, products.id))
    .where(eq(products.active, true))
    .orderBy(asc(products.name));
}

/** Open assembly lots (not completed/cancelled), soonest ETA first. */
export async function listOpenAssemblyLots() {
  const db = getDb();
  return db
    .select({
      lot: assemblyLots,
      productName: products.name,
    })
    .from(assemblyLots)
    .innerJoin(products, eq(products.id, assemblyLots.productId))
    .where(inArray(assemblyLots.status, ["planned", "in_progress"]))
    .orderBy(asc(assemblyLots.eta), asc(assemblyLots.createdAt));
}

/** Compact dashboard snapshot for the weekly ops review. */
export async function getInventoryDashboardSnapshot() {
  const db = getDb();

  const [fg] = await db
    .select({
      totalQty: sql<number>`coalesce(sum(${finishedGoods.qty}), 0)::int`,
      variants: sql<number>`count(*)::int`,
    })
    .from(finishedGoods);

  const [partsOnHand] = await db
    .select({
      rows: sql<number>`count(*)::int`,
      onOrderLines: sql<number>`count(*) filter (where ${partInventory.onOrderQty} > 0)::int`,
    })
    .from(partInventory);

  const openLots = await listOpenAssemblyLots();

  const dueSoon = openLots.filter((row) => {
    if (!row.lot.eta) return false;
    const eta = new Date(`${row.lot.eta}T00:00:00Z`);
    const inTwoWeeks = new Date();
    inTwoWeeks.setUTCDate(inTwoWeeks.getUTCDate() + 14);
    return eta <= inTwoWeeks;
  });

  return {
    finishedGoodsTotal: fg?.totalQty ?? 0,
    finishedGoodsVariants: fg?.variants ?? 0,
    partInventoryRows: partsOnHand?.rows ?? 0,
    partsOnOrderLines: partsOnHand?.onOrderLines ?? 0,
    openLots,
    dueSoon,
    openLotCount: openLots.length,
  };
}
