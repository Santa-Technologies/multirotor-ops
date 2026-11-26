import { randomBytes } from "node:crypto";

const TOKEN_RE = /\bRFQ-([A-Z0-9]{6})\b/i;

/** Builds a short subject token like RFQ-A1B2C3 for inbound matching. */
export function createSubjectToken(): string {
  return `RFQ-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Pulls the RFQ-XXXXXX token from a subject line, if present. */
export function extractSubjectToken(subject: string): string | null {
  const match = subject.match(TOKEN_RE);
  if (!match?.[1]) return null;
  return `RFQ-${match[1].toUpperCase()}`;
}

/** Open thread statuses that block a second outbound RFQ for the same part. */
export const OPEN_RFQ_STATUSES = [
  "sent",
  "awaiting_reply",
  "offer_received",
] as const;
