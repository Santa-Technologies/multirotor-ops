import "server-only";

import { fetchJson } from "@/lib/pricing-providers/fetch-with-retry";

/** Structured fields extracted from a supplier offer PDF / email. */
export type ParsedOfferDraft = {
  qty: number | null;
  /** Unit price in euro cents when currency is EUR; otherwise null until converted. */
  unitPriceCents: number | null;
  currency: string;
  /** Unit price in source currency (euros if EUR), for conversion / display. */
  unitPrice: number | null;
  stock: number | null;
  validUntil: string | null;
  leadDays: number | null;
  notes: string | null;
  raw: Record<string, unknown>;
};

const EXTRACT_SCHEMA_HINT = `{
  "mpn": string | null,
  "qty": number | null,
  "unit_price": number | null,
  "currency": string | null,
  "stock": number | null,
  "valid_until": string | null,
  "lead_days": number | null,
  "notes": string | null
}`;

/**
 * Calls OpenAI Responses API with a PDF attachment and returns a structured
 * offer draft. Never writes to the database — human confirm is required.
 */
export async function parseOfferPdf(options: {
  pdfBytes: Uint8Array;
  filename: string;
  mpnHint: string;
}): Promise<ParsedOfferDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for offer PDF parsing.");
  }

  const base64 = Buffer.from(options.pdfBytes).toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const payload = await fetchJson<{
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
    error?: { message?: string };
  }>({
    url: "https://api.openai.com/v1/responses",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OFFER_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: options.filename,
              file_data: dataUrl,
            },
            {
              type: "input_text",
              text: [
                "Extract the supplier price offer for electronic parts from this PDF.",
                `Preferred MPN hint: ${options.mpnHint}.`,
                "Return ONLY a JSON object matching this shape (no markdown):",
                EXTRACT_SCHEMA_HINT,
                "Use ISO dates YYYY-MM-DD for valid_until. unit_price is a decimal in the quoted currency.",
                "If multiple breaks exist, pick the smallest qty break that is clearly priced.",
              ].join("\n"),
            },
          ],
        },
      ],
    }),
    label: "OpenAI offer parse",
    timeoutMs: 60_000,
    retries: 1,
  });

  if (payload.error?.message) {
    throw new Error(`OpenAI offer parse: ${payload.error.message}`);
  }

  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((o) => o.content ?? [])
      .find((c) => c.type === "output_text" || c.text)?.text ??
    "";

  return normaliseExtract(parseJsonObject(text));
}

/** Pure: turns a loose extract object into a typed draft. */
export function normaliseExtract(raw: Record<string, unknown>): ParsedOfferDraft {
  const currency =
    typeof raw.currency === "string" && raw.currency.trim()
      ? raw.currency.trim().toUpperCase()
      : "EUR";
  const unitPrice = asFiniteNumber(raw.unit_price ?? raw.unitPrice);
  const qty = asPositiveInt(raw.qty);
  const stock = asNonNegInt(raw.stock);
  const leadDays = asNonNegInt(raw.lead_days ?? raw.leadDays);
  const validUntil = asIsoDate(raw.valid_until ?? raw.validUntil);
  const notes =
    typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;

  let unitPriceCents: number | null = null;
  if (unitPrice != null && currency === "EUR") {
    unitPriceCents = Math.round(unitPrice * 100);
  }

  return {
    qty,
    unitPriceCents,
    currency,
    unitPrice,
    stock,
    validUntil,
    leadDays,
    notes,
    raw,
  };
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Offer parse returned no JSON object.");
  }
  const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Offer parse JSON was not an object.");
  }
  return parsed as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asPositiveInt(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n == null || n < 1) return null;
  return Math.round(n);
}

function asNonNegInt(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n == null || n < 0) return null;
  return Math.round(n);
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}
