import "server-only";

import { Resend } from "resend";

import { fetchJson } from "@/lib/pricing-providers/fetch-with-retry";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult = {
  id: string;
};

/** Thin Resend send adapter with clear errors (never logs the API key). */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send RFQs.");
  }

  const payload = await fetchJson<{
    id?: string;
    message?: string;
    name?: string;
  }>({
    url: "https://api.resend.com/emails",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      reply_to: input.replyTo,
      headers: input.headers,
      tags: input.tags,
    }),
    label: "Resend send",
  });

  if (!payload.id) {
    throw new Error(
      `Resend send failed: ${payload.message ?? payload.name ?? "missing id"}`,
    );
  }
  return { id: payload.id };
}

/** Builds a Resend client when API key is present (webhooks / receiving). */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  return new Resend(apiKey);
}

/**
 * Verifies a Resend webhook using the SDK (Svix). Throws when invalid.
 * Requires the raw request body string.
 */
export function verifyResendWebhook(options: {
  payload: string;
  id: string;
  timestamp: string;
  signature: string;
}): unknown {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error("RESEND_WEBHOOK_SECRET is not configured.");
  const resend = getResendClient();
  return resend.webhooks.verify({
    payload: options.payload,
    headers: {
      id: options.id,
      timestamp: options.timestamp,
      signature: options.signature,
    },
    webhookSecret: secret,
  });
}
