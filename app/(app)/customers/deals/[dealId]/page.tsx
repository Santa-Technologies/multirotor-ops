import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeaderActions } from "@/components/page-header-actions";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { getDealDetail } from "@/lib/customers/queries";

import { DealActionsBar, OrderFollowUpForms } from "./forms";

type PageProps = { params: Promise<{ dealId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  return { title: detail ? detail.deal.title : "Deal" };
}

export default async function DealDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  if (!detail) notFound();

  const { deal, company, contact, requests, quotes, orders } = detail;
  const canRequest = canWrite(user.role, "requests", "insert");
  const canOrder = canWrite(user.role, "sales_orders", "insert");
  const canInvoice = canWrite(user.role, "sales_invoices", "insert");
  const canShip = canWrite(user.role, "sales_shipments", "update");

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/customers" className="underline-offset-4 hover:underline">
            Customers
          </Link>
        </p>
        <PageHeaderActions
          title={deal.title}
          description={`${deal.pipelineName ?? "Pipeline"} · ${deal.stageName ?? "No stage"} · PD #${deal.pipedriveId}. Stages are read-only.`}
          actions={
            <DealActionsBar
              deal={{
                id: deal.id,
                title: deal.title,
                pipedriveId: deal.pipedriveId,
              }}
              company={company ? { id: company.id, name: company.name } : null}
              contact={contact ? { id: contact.id, name: contact.name } : null}
              canRequest={canRequest}
              canOrder={canOrder}
            />
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border px-4 py-3">
          <p className="text-xs text-muted-foreground">Company</p>
          <p className="font-medium">{company?.name ?? "—"}</p>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <p className="text-xs text-muted-foreground">Contact</p>
          <p className="font-medium">{contact?.name ?? "—"}</p>
          {contact?.email ? (
            <p className="text-xs text-muted-foreground">{contact.email}</p>
          ) : null}
        </div>
        <div className="rounded-lg border px-4 py-3">
          <p className="text-xs text-muted-foreground">Value</p>
          <p className="font-medium tabular-nums">
            {deal.valueAmount != null
              ? `${Number(deal.valueAmount).toLocaleString("de-DE", {
                  maximumFractionDigits: 2,
                })} ${deal.currency}`
              : "—"}
          </p>
        </div>
      </div>

      <LinkedList
        title="Requests"
        empty="No linked requests."
        items={requests.map((r) => ({
          id: r.id,
          primary: r.summary,
          secondary: `${r.status.replaceAll("_", " ")} · ${r.type.replaceAll("_", " ")}`,
          href: "/requests",
        }))}
      />

      <LinkedList
        title="Quotes"
        empty="No linked quotes."
        items={quotes.map((q) => ({
          id: q.id,
          primary: `${q.number} v${q.version}`,
          secondary: `${q.status} · qty ${q.quantity.toLocaleString("de-DE")}`,
          href: `/quotes/${q.id}`,
        }))}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales orders yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="font-medium">{o.status.replaceAll("_", " ")}</span>
                  <span className="text-muted-foreground">
                    {o.qty != null ? ` · qty ${o.qty.toLocaleString("de-DE")}` : ""}
                    {o.notes ? ` · ${o.notes}` : ""}
                  </span>
                </div>
                <OrderFollowUpForms
                  dealId={deal.id}
                  orderId={o.id}
                  canInvoice={canInvoice}
                  canShip={canShip}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LinkedList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; primary: string; secondary: string; href: string }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3 text-sm">
              <Link href={item.href} className="font-medium underline-offset-4 hover:underline">
                {item.primary}
              </Link>
              <p className="text-xs text-muted-foreground">{item.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
