import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { formatEuroCents } from "@/lib/format/money";
import type { QuoteResult } from "@/lib/pricing";
import { quoteText } from "@/lib/pricing";
import { getQuoteDetail } from "@/lib/quotes/lifecycle";

import { ApproveForm, MarkSentForm, ReviseForm } from "./forms";

type PageProps = { params: Promise<{ quoteId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { quoteId } = await params;
  const detail = await getQuoteDetail(quoteId);
  return { title: detail ? detail.quote.number : "Quote" };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { quoteId } = await params;
  const detail = await getQuoteDetail(quoteId);
  if (!detail) notFound();

  const { quote, productName, companyName } = detail;
  const result = quote.outputs as unknown as QuoteResult;
  const inputs = quote.inputs as { productName?: string; kind?: string };
  const name = inputs.productName ?? productName;
  const customerFacing = quote.status === "sent";

  const body = quoteText(result, name, {
    customerFacing,
    companyName,
    quoteNumber: quote.number,
    validUntil: quote.validUntil,
  });

  const canSend = canWrite(user.role, "quotes", "update");
  const canRevise = canWrite(user.role, "quotes", "insert");
  const needsApproval = quote.approvalStatus === "pending";
  const canApprove = user.role === "admin" && needsApproval && quote.status === "draft";

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/quotes" className="underline-offset-4 hover:underline">
            Quotes
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          {quote.number}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            v{quote.version} · {quote.status}
            {quote.approvalStatus !== "not_required"
              ? ` · approval ${quote.approvalStatus.replaceAll("_", " ")}`
              : ""}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {name} · {quote.quantity.toLocaleString("de-DE")} units
          {companyName ? ` · ${companyName}` : ""}
          {" · valid "}
          {formatDate(quote.validUntil)}
          {quote.sentAt
            ? ` · sent ${quote.sentAt.toLocaleString("de-DE")}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/quotes/${quote.id}/pdf`}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
        >
          Download PDF
        </a>
      </div>

      {needsApproval && quote.status === "draft" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Admin approval required before send
          {result.approval?.reasons?.length
            ? `: ${result.approval.reasons.join(", ").replaceAll("_", " ")}`
            : "."}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {customerFacing ? "Customer quote text" : "Indicative draft text"}
          </h2>
          <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
            {body}
          </pre>
          <p className="text-xs text-muted-foreground">
            Screen numbers use German locale elsewhere; quote text and PDF use English
            locale.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-4 text-sm">
            <p>
              Unit{" "}
              <span className="font-medium">
                {formatEuroCents(result.low.unitPriceCents)} –{" "}
                {formatEuroCents(result.high.unitPriceCents)}
              </span>
            </p>
            <p className="mt-1 text-muted-foreground">
              Margin {result.marginPct} % · deposit {result.depositPct} % · payment{" "}
              {result.paymentDays} days
            </p>
          </div>

          {canApprove ? <ApproveForm quoteId={quote.id} /> : null}

          {canSend && quote.status === "draft" ? (
            <MarkSentForm
              quoteId={quote.id}
              defaultCompanyId={quote.companyId}
              defaultCompanyLabel={companyName}
              defaultDealId={quote.pipedriveDealId}
              defaultDealUuid={quote.dealId}
            />
          ) : null}

          {canRevise && quote.status === "sent" ? (
            <ReviseForm quoteId={quote.id} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
