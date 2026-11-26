"use server";

import { revalidatePath } from "next/cache";

import { quotes } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  calculateQuote,
  type CostRunInput,
  type PricingSettings,
  type QuoteResult,
} from "@/lib/pricing";
import { nextQuoteNumber } from "@/lib/quotes/number";

export type SaveDraftState = {
  status: "idle" | "ok" | "error";
  message?: string;
  quoteId?: string;
  quoteNumber?: string;
};

export type SaveDraftPayload = {
  productId: string;
  productName: string;
  quantity: number;
  depositPct: number;
  paymentDays: number;
  marginPct?: number;
  costRunId: string | null;
  costRun: CostRunInput | null;
  settings: PricingSettings;
};

/**
 * Saves an internal draft scenario from the pricing playground. Does not mark
 * the quote as sent and does not email the customer.
 */
export async function saveDraftScenario(
  payload: SaveDraftPayload,
): Promise<SaveDraftState> {
  const user = await requireUser();
  if (!canWrite(user.role, "quotes", "insert")) {
    return { status: "error", message: "You cannot save quote scenarios." };
  }

  if (!Number.isInteger(payload.quantity) || payload.quantity < 1) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }

  let result: QuoteResult;
  try {
    result = calculateQuote(
      {
        quantity: payload.quantity,
        depositPct: payload.depositPct,
        paymentDays: payload.paymentDays,
        marginPct: payload.marginPct,
        costRun: payload.costRun ?? undefined,
        asOf: new Date(),
      },
      payload.settings,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not price this scenario.",
    };
  }

  try {
    const number = await nextQuoteNumber();
    const validUntil = new Date();
    validUntil.setUTCDate(validUntil.getUTCDate() + result.validityDays);

    const [row] = await withActor(user.id, async (tx) =>
      tx
        .insert(quotes)
        .values({
          number,
          productId: payload.productId,
          quantity: payload.quantity,
          inputs: {
            quantity: payload.quantity,
            depositPct: payload.depositPct,
            paymentDays: payload.paymentDays,
            marginPct: result.marginPct,
            productName: payload.productName,
            kind: "playground_draft",
          },
          outputs: result as unknown as Record<string, unknown>,
          costRunId: payload.costRunId,
          status: "draft",
          version: 1,
          approvalStatus: result.approval.required ? "pending" : "not_required",
          validUntil: validUntil.toISOString().slice(0, 10),
        })
        .returning({ id: quotes.id, number: quotes.number }),
    );

    revalidatePath("/quotes");
    return {
      status: "ok",
      message: `Saved internal draft ${row!.number}. Not sent to the customer.`,
      quoteId: row!.id,
      quoteNumber: row!.number,
    };
  } catch {
    return { status: "error", message: "Could not save the draft scenario." };
  }
}
