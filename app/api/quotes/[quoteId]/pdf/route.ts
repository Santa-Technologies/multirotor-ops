import { requireUser } from "@/lib/auth/current-user";
import type { QuoteResult } from "@/lib/pricing";
import { buildQuotePdfBuffer } from "@/lib/quotes/build-pdf";
import { getQuoteDetail } from "@/lib/quotes/lifecycle";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ quoteId: string }> };

/** Authenticated PDF download for a quote (customer-facing wording). */
export async function GET(_request: Request, context: RouteContext) {
  await requireUser();
  const { quoteId } = await context.params;
  const detail = await getQuoteDetail(quoteId);
  if (!detail) {
    return new Response("Quote not found.", { status: 404 });
  }

  const result = detail.quote.outputs as unknown as QuoteResult;
  const productName =
    (detail.quote.inputs as { productName?: string }).productName ??
    detail.productName;

  const buffer = await buildQuotePdfBuffer({
    quoteNumber: detail.quote.number,
    productName,
    companyName: detail.companyName,
    result,
    validUntil: detail.quote.validUntil,
    issuedAt: detail.quote.sentAt ?? detail.quote.createdAt,
  });

  const filename = `${detail.quote.number}-v${detail.quote.version}.pdf`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
