import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { companies, products, quotes } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import type { QuoteResult } from "@/lib/pricing";
import { quoteText } from "@/lib/pricing";
import { addPipedriveDealNote } from "@/lib/pipedrive/notes";

export type QuoteRow = typeof quotes.$inferSelect;

/** Loads a quote with product and company labels. */
export async function getQuoteDetail(quoteId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      quote: quotes,
      productName: products.name,
      companyName: companies.name,
    })
    .from(quotes)
    .innerJoin(products, eq(products.id, quotes.productId))
    .leftJoin(companies, eq(companies.id, quotes.companyId))
    .where(eq(quotes.id, quoteId))
    .limit(1);
  return row ?? null;
}

/** Admin approval for quotes that require it before send. */
export async function approveQuote(quoteId: string, actorId: string) {
  const detail = await getQuoteDetail(quoteId);
  if (!detail) throw new Error("Quote not found.");
  if (detail.quote.status !== "draft") {
    throw new Error("Only draft quotes can be approved.");
  }
  if (detail.quote.approvalStatus === "approved") {
    return detail.quote;
  }
  if (
    detail.quote.approvalStatus !== "pending" &&
    detail.quote.approvalStatus !== "not_required"
  ) {
    throw new Error("Quote is not awaiting approval.");
  }

  const [updated] = await withActor(actorId, async (tx) =>
    tx
      .update(quotes)
      .set({
        approvalStatus: "approved",
        approvedBy: actorId,
      })
      .where(eq(quotes.id, quoteId))
      .returning(),
  );
  return updated!;
}

/**
 * Marks a draft quote as sent. Requires company, and approval when the engine
 * flagged it. Optionally posts a Pipedrive deal note. Sent quotes are immutable.
 */
export async function markQuoteSent(options: {
  quoteId: string;
  actorId: string;
  companyId: string;
  pipedriveDealId?: number | null;
  postPipedriveNote?: boolean;
}) {
  const detail = await getQuoteDetail(options.quoteId);
  if (!detail) throw new Error("Quote not found.");
  if (detail.quote.status !== "draft") {
    throw new Error("Only draft quotes can be marked sent.");
  }
  if (
    detail.quote.approvalStatus === "pending" ||
    detail.quote.approvalStatus === "rejected"
  ) {
    throw new Error("This quote needs admin approval before it can be sent.");
  }

  const result = detail.quote.outputs as unknown as QuoteResult;
  const productName =
    (detail.quote.inputs as { productName?: string }).productName ??
    detail.productName;

  const [company] = await getDb()
    .select()
    .from(companies)
    .where(eq(companies.id, options.companyId))
    .limit(1);
  if (!company) throw new Error("Company not found.");

  const dealId = options.pipedriveDealId ?? detail.quote.pipedriveDealId;
  let pipedriveNoteId: number | null = null;

  if (options.postPipedriveNote && dealId != null) {
    const body = quoteText(result, productName, {
      customerFacing: true,
      companyName: company.name,
      quoteNumber: detail.quote.number,
      validUntil: detail.quote.validUntil,
    });
    const note = await addPipedriveDealNote({
      dealId,
      contentHtml: `<p><strong>Quote ${detail.quote.number} marked sent</strong></p><pre>${escapeHtml(body)}</pre>`,
    });
    pipedriveNoteId = note.id;
  }

  const [updated] = await withActor(options.actorId, async (tx) =>
    tx
      .update(quotes)
      .set({
        status: "sent",
        sentAt: new Date(),
        companyId: options.companyId,
        pipedriveDealId: dealId ?? null,
        inputs: {
          ...(detail.quote.inputs as Record<string, unknown>),
          kind: "customer_sent",
          pipedriveNoteId,
        },
      })
      .where(and(eq(quotes.id, options.quoteId), eq(quotes.status, "draft")))
      .returning(),
  );

  if (!updated) throw new Error("Quote could not be marked sent.");
  return updated;
}

/**
 * Creates a new draft version from a sent quote (immutable history).
 * Copies frozen inputs/outputs; caller can edit via playground later if needed.
 */
export async function reviseSentQuote(quoteId: string, actorId: string) {
  const detail = await getQuoteDetail(quoteId);
  if (!detail) throw new Error("Quote not found.");
  if (detail.quote.status !== "sent") {
    throw new Error("Only sent quotes can be revised into a new version.");
  }

  const [latest] = await getDb()
    .select({ version: quotes.version })
    .from(quotes)
    .where(eq(quotes.number, detail.quote.number))
    .orderBy(desc(quotes.version))
    .limit(1);

  const nextVersion = (latest?.version ?? detail.quote.version) + 1;

  const [created] = await withActor(actorId, async (tx) =>
    tx
      .insert(quotes)
      .values({
        number: detail.quote.number,
        companyId: detail.quote.companyId,
        requestId: detail.quote.requestId,
        productId: detail.quote.productId,
        quantity: detail.quote.quantity,
        inputs: {
          ...(detail.quote.inputs as Record<string, unknown>),
          kind: "playground_draft",
          revisedFromVersion: detail.quote.version,
        },
        outputs: detail.quote.outputs,
        costRunId: detail.quote.costRunId,
        status: "draft",
        version: nextVersion,
        approvalStatus: detail.quote.approvalStatus === "approved"
          ? "pending"
          : detail.quote.approvalStatus,
        validUntil: detail.quote.validUntil,
        pipedriveDealId: detail.quote.pipedriveDealId,
      })
      .returning(),
  );

  return created!;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
