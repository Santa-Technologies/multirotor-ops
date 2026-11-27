import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { distributors, parts, rfqOffers, rfqThreads, suppliers } from "@/db/schema";

import { OPEN_RFQ_STATUSES } from "./subject-token";

/** Active suppliers for RFQ forms. */
export async function listActiveSuppliers() {
  const db = getDb();
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
}

/** Distributor directory (pricing + RFQ mailbox / address). */
export async function listDistributors() {
  const db = getDb();
  return db.select().from(distributors).orderBy(asc(distributors.name));
}

/** Open RFQ threads with part and supplier labels. */
export async function listOpenRfqThreads() {
  const db = getDb();
  return db
    .select({
      thread: rfqThreads,
      mpn: parts.mpn,
      manufacturer: parts.manufacturer,
      supplierName: suppliers.name,
      supplierEmail: suppliers.email,
    })
    .from(rfqThreads)
    .innerJoin(parts, eq(parts.id, rfqThreads.partId))
    .innerJoin(suppliers, eq(suppliers.id, rfqThreads.supplierId))
    .where(inArray(rfqThreads.status, [...OPEN_RFQ_STATUSES]))
    .orderBy(desc(rfqThreads.createdAt));
}

/** Offers waiting for human confirm. */
export async function listPendingRfqOffers() {
  const db = getDb();
  return db
    .select({
      offer: rfqOffers,
      thread: rfqThreads,
      mpn: parts.mpn,
      supplierName: suppliers.name,
    })
    .from(rfqOffers)
    .innerJoin(rfqThreads, eq(rfqThreads.id, rfqOffers.rfqThreadId))
    .innerJoin(parts, eq(parts.id, rfqThreads.partId))
    .innerJoin(suppliers, eq(suppliers.id, rfqThreads.supplierId))
    .where(eq(rfqOffers.status, "pending_confirm"))
    .orderBy(desc(rfqOffers.createdAt));
}
