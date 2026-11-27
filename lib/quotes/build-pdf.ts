import "server-only";

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import type { QuoteResult } from "@/lib/pricing";
import { quoteText } from "@/lib/pricing";

import { QuotePdfDocument } from "./pdf-document";

/** Renders a customer-facing quote PDF buffer from frozen quote outputs. */
export async function buildQuotePdfBuffer(options: {
  quoteNumber: string;
  productName: string;
  companyName: string | null;
  result: QuoteResult;
  validUntil: string | null;
  issuedAt: Date;
}): Promise<Buffer> {
  const text = quoteText(options.result, options.productName, {
    customerFacing: true,
    companyName: options.companyName,
    quoteNumber: options.quoteNumber,
    validUntil: options.validUntil,
  });

  const element = createElement(QuotePdfDocument, {
    quoteNumber: options.quoteNumber,
    companyName: options.companyName,
    productName: options.productName,
    bodyLines: text.split("\n"),
    issuedAt: options.issuedAt.toLocaleDateString("en-GB"),
  });

  // react-pdf types expect DocumentProps; our wrapper component returns a Document.
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

