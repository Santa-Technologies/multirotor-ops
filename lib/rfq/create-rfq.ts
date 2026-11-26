import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { parts, rfqThreads, suppliers } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { sendEmail } from "@/lib/email/resend";

import { createSubjectToken, OPEN_RFQ_STATUSES } from "./subject-token";

export type CreateRfqInput = {
  partId: string;
  supplierId: string;
  qtyRequested: number;
  actorId: string;
  notes?: string | null;
};

export type CreateRfqResult =
  | { ok: true; threadId: string; subjectToken: string; deduped: false }
  | { ok: true; threadId: string; subjectToken: string; deduped: true }
  | { ok: false; error: string };

/**
 * Opens one outbound RFQ for a part. If an open thread already exists for that
 * part, returns it without sending another email (cross-BOM dedupe).
 */
export async function createAndSendRfq(
  input: CreateRfqInput,
): Promise<CreateRfqResult> {
  if (!Number.isFinite(input.qtyRequested) || input.qtyRequested < 1) {
    return { ok: false, error: "Quantity must be a positive integer." };
  }

  const db = getDb();
  const [part] = await db
    .select()
    .from(parts)
    .where(eq(parts.id, input.partId))
    .limit(1);
  if (!part) return { ok: false, error: "Part not found." };

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.active, true)))
    .limit(1);
  if (!supplier) return { ok: false, error: "Supplier not found or inactive." };

  const [existing] = await db
    .select()
    .from(rfqThreads)
    .where(
      and(
        eq(rfqThreads.partId, input.partId),
        inArray(rfqThreads.status, [...OPEN_RFQ_STATUSES]),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      ok: true,
      threadId: existing.id,
      subjectToken: existing.subjectToken,
      deduped: true,
    };
  }

  const subjectToken = createSubjectToken();
  const replyTo = process.env.RESEND_RFQ_REPLY_TO ?? process.env.RESEND_FROM_EMAIL;
  const subject = `Price request ${part.mpn} [${subjectToken}]`;
  const body = [
    `Hello ${supplier.name},`,
    "",
    `Please quote the following part for Santa Technologies (Kern / Multirotor Ops):`,
    "",
    `MPN: ${part.mpn}`,
    part.manufacturer ? `Manufacturer: ${part.manufacturer}` : null,
    part.description ? `Description: ${part.description}` : null,
    `Quantity: ${input.qtyRequested}`,
    "",
    "Please reply with unit price (EUR preferred), MOQ, stock, lead time and validity.",
    "A PDF offer is welcome.",
    "",
    `Please keep [${subjectToken}] in the subject when replying.`,
    "",
    "Thank you,",
    "Santa Technologies — Supply",
  ]
    .filter((line) => line !== null)
    .join("\n");

  let sentId: string;
  try {
    const sent = await sendEmail({
      to: supplier.email,
      subject,
      text: body,
      replyTo: replyTo || undefined,
      tags: [
        { name: "rfq_token", value: subjectToken },
        { name: "part_mpn", value: part.mpn.slice(0, 48) },
      ],
    });
    sentId = sent.id;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send RFQ email.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [thread] = await withActor(input.actorId, async (tx) =>
    tx
      .insert(rfqThreads)
      .values({
        partId: input.partId,
        supplierId: input.supplierId,
        status: "awaiting_reply",
        subjectToken,
        qtyRequested: input.qtyRequested,
        outboundResendId: sentId,
        sentAt: today,
        notes: input.notes ?? null,
      })
      .returning(),
  );

  return {
    ok: true,
    threadId: thread!.id,
    subjectToken,
    deduped: false,
  };
}
