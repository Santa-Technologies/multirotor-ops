import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { manualQuotes, parts, rfqOffers, rfqThreads, suppliers } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { toEuroCents } from "@/lib/fx/ecb";

export type ConfirmOfferInput = {
  offerId: string;
  actorId: string;
  qty: number;
  unitPriceCents: number;
  validUntil?: string | null;
  stock?: number | null;
};

/**
 * Human-confirmed write path: inserts a manual_quotes row and marks the offer
 * + RFQ thread confirmed. Never called from the LLM parse alone.
 */
export async function confirmRfqOffer(input: ConfirmOfferInput) {
  if (!Number.isFinite(input.qty) || input.qty < 1) {
    throw new Error("Quantity must be a positive integer.");
  }
  if (!Number.isFinite(input.unitPriceCents) || input.unitPriceCents < 0) {
    throw new Error("Unit price must be a non-negative euro cent amount.");
  }

  const db = getDb();
  const [row] = await db
    .select({
      offer: rfqOffers,
      thread: rfqThreads,
      part: parts,
      supplier: suppliers,
    })
    .from(rfqOffers)
    .innerJoin(rfqThreads, eq(rfqThreads.id, rfqOffers.rfqThreadId))
    .innerJoin(parts, eq(parts.id, rfqThreads.partId))
    .innerJoin(suppliers, eq(suppliers.id, rfqThreads.supplierId))
    .where(eq(rfqOffers.id, input.offerId))
    .limit(1);

  if (!row) throw new Error("Offer not found.");
  if (row.offer.status !== "pending_confirm") {
    throw new Error("Offer is not pending confirmation.");
  }

  const quotedAt = new Date().toISOString().slice(0, 10);

  return withActor(input.actorId, async (tx) => {
    const [quote] = await tx
      .insert(manualQuotes)
      .values({
        mpn: row.part.mpn,
        supplier: row.supplier.name,
        qty: input.qty,
        unitPriceCents: input.unitPriceCents,
        quotedAt,
        validUntil: input.validUntil ?? row.offer.validUntil,
        sourceNote: `Confirmed RFQ ${row.thread.subjectToken}${
          input.stock != null ? ` · stock ${input.stock}` : ""
        }`,
        enteredBy: input.actorId,
      })
      .returning({ id: manualQuotes.id });

    await tx
      .update(rfqOffers)
      .set({
        status: "confirmed",
        qty: input.qty,
        unitPriceCents: input.unitPriceCents,
        validUntil: input.validUntil ?? row.offer.validUntil,
        stock: input.stock ?? row.offer.stock,
        confirmedManualQuoteId: quote!.id,
      })
      .where(eq(rfqOffers.id, input.offerId));

    await tx
      .update(rfqThreads)
      .set({ status: "confirmed" })
      .where(
        and(eq(rfqThreads.id, row.thread.id), eq(rfqThreads.status, "offer_received")),
      );

    // Also close if still awaiting (manual confirm without inbound state).
    await tx
      .update(rfqThreads)
      .set({ status: "confirmed" })
      .where(
        and(
          eq(rfqThreads.id, row.thread.id),
          eq(rfqThreads.status, "awaiting_reply"),
        ),
      );

    return { manualQuoteId: quote!.id };
  });
}

/** Rejects a pending offer without writing prices. */
export async function rejectRfqOffer(offerId: string, actorId: string) {
  await withActor(actorId, async (tx) => {
    const [updated] = await tx
      .update(rfqOffers)
      .set({ status: "rejected" })
      .where(and(eq(rfqOffers.id, offerId), eq(rfqOffers.status, "pending_confirm")))
      .returning({ id: rfqOffers.id, rfqThreadId: rfqOffers.rfqThreadId });
    if (!updated) throw new Error("Offer not found or not pending.");
  });
}

/**
 * Converts a non-EUR unit price to euro cents using provided ECB rates.
 * Used when confirming offers that arrived in a foreign currency.
 */
export function unitPriceToEuroCents(
  unitPrice: number,
  currency: string,
  rates: Record<string, number>,
): number | null {
  return toEuroCents(unitPrice, currency, rates);
}
