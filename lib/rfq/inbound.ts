import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { parts, rfqOffers, rfqThreads } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { getResendClient } from "@/lib/email/resend";

import { parseOfferPdf } from "./parse-offer";
import { extractSubjectToken } from "./subject-token";

export type InboundEmailEvent = {
  type: string;
  data: {
    email_id: string;
    from?: string;
    subject?: string;
    message_id?: string;
  };
};

/**
 * Handles a Resend email.received event: match RFQ thread by subject token,
 * download PDF attachments, LLM-parse into a pending rfq_offers row.
 */
export async function handleInboundRfqEmail(
  event: InboundEmailEvent,
  actorId: string | null,
): Promise<{ matched: boolean; offerId?: string; reason?: string }> {
  if (event.type !== "email.received") {
    return { matched: false, reason: "ignored_event_type" };
  }

  const subject = event.data.subject ?? "";
  const token = extractSubjectToken(subject);
  if (!token) {
    return { matched: false, reason: "no_subject_token" };
  }

  const db = getDb();
  const [threadRow] = await db
    .select({ thread: rfqThreads, part: parts })
    .from(rfqThreads)
    .innerJoin(parts, eq(parts.id, rfqThreads.partId))
    .where(eq(rfqThreads.subjectToken, token))
    .limit(1);

  if (!threadRow) {
    return { matched: false, reason: "unknown_token" };
  }

  const resend = getResendClient();
  const { data: attachments, error: listError } =
    await resend.emails.receiving.attachments.list({
      emailId: event.data.email_id,
    });

  if (listError) {
    console.error("Resend attachments list failed", listError);
    return { matched: false, reason: "attachments_list_failed" };
  }

  const pdfs = (attachments?.data ?? []).filter((a) => {
    const name = (a.filename ?? "").toLowerCase();
    const type = (a.content_type ?? "").toLowerCase();
    return name.endsWith(".pdf") || type.includes("pdf");
  });

  if (pdfs.length === 0) {
    // Still mark thread as offer_received so supply can follow up manually.
    await updateThreadInbound(threadRow.thread.id, event, actorId);
    return { matched: true, reason: "no_pdf_attachment" };
  }

  const first = pdfs[0]!;
  const download = await fetch(first.download_url);
  if (!download.ok) {
    console.error("Failed to download RFQ attachment", first.filename, download.status);
    return { matched: false, reason: "download_failed" };
  }
  const bytes = new Uint8Array(await download.arrayBuffer());

  let draft;
  try {
    draft = await parseOfferPdf({
      pdfBytes: bytes,
      filename: first.filename ?? "offer.pdf",
      mpnHint: threadRow.part.mpn,
    });
  } catch (error) {
    console.error("Offer PDF parse failed", error);
    await updateThreadInbound(threadRow.thread.id, event, actorId);
    return { matched: true, reason: "parse_failed" };
  }

  const offerId = await persistPendingOffer({
    threadId: threadRow.thread.id,
    actorId,
    event,
    filename: first.filename ?? "offer.pdf",
    draft,
  });

  return { matched: true, offerId };
}

async function updateThreadInbound(
  threadId: string,
  event: InboundEmailEvent,
  actorId: string | null,
) {
  const work = async (
    tx: Parameters<Parameters<typeof withActor>[1]>[0] | ReturnType<typeof getDb>,
  ) => {
    await tx
      .update(rfqThreads)
      .set({
        status: "offer_received",
        lastInboundEmailId: event.data.email_id,
        lastInboundMessageId: event.data.message_id ?? null,
      })
      .where(eq(rfqThreads.id, threadId));
  };
  if (actorId) await withActor(actorId, (tx) => work(tx));
  else await work(getDb());
}

async function persistPendingOffer(options: {
  threadId: string;
  actorId: string | null;
  event: InboundEmailEvent;
  filename: string;
  draft: Awaited<ReturnType<typeof parseOfferPdf>>;
}): Promise<string> {
  const write = async (
    tx: Parameters<Parameters<typeof withActor>[1]>[0] | ReturnType<typeof getDb>,
  ) => {
    await tx
      .update(rfqThreads)
      .set({
        status: "offer_received",
        lastInboundEmailId: options.event.data.email_id,
        lastInboundMessageId: options.event.data.message_id ?? null,
      })
      .where(eq(rfqThreads.id, options.threadId));

    const [offer] = await tx
      .insert(rfqOffers)
      .values({
        rfqThreadId: options.threadId,
        status: "pending_confirm",
        sourceFilename: options.filename,
        inboundEmailId: options.event.data.email_id,
        extractJson: options.draft.raw,
        qty: options.draft.qty,
        unitPriceCents: options.draft.unitPriceCents,
        currency: options.draft.currency,
        stock: options.draft.stock,
        validUntil: options.draft.validUntil,
        leadDays: options.draft.leadDays,
        parseNotes: options.draft.notes,
      })
      .returning({ id: rfqOffers.id });
    return offer!.id;
  };

  if (options.actorId) return withActor(options.actorId, (tx) => write(tx));
  return write(getDb());
}
