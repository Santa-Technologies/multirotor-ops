import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyResendWebhook } from "@/lib/email/resend";
import {
  handleInboundRfqEmail,
  type InboundEmailEvent,
} from "@/lib/rfq/inbound";

export const maxDuration = 60;

/**
 * Resend inbound webhook (email.received). Public path; authenticated via
 * Svix signature (RESEND_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    return Response.json({ error: "Missing Svix headers." }, { status: 400 });
  }

  let event: InboundEmailEvent;
  try {
    event = verifyResendWebhook({
      payload,
      id,
      timestamp,
      signature,
    }) as InboundEmailEvent;
  } catch (error) {
    console.error("Resend webhook verification failed", error);
    return Response.json({ error: "Invalid webhook." }, { status: 400 });
  }

  const db = getDb();
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  const result = await handleInboundRfqEmail(event, admin?.id ?? null);
  return Response.json({ ok: true, ...result });
}
