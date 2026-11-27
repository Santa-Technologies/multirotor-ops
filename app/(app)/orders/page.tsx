import type { Metadata } from "next";
import Link from "next/link";

import { PageHeaderActions } from "@/components/page-header-actions";
import { requireUser } from "@/lib/auth/current-user";
import { listSalesOrders } from "@/lib/sales/orders";

export const metadata: Metadata = { title: "Orders" };

type PageProps = { searchParams: Promise<{ page?: string }> };

export default async function OrdersPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const rows = await listSalesOrders(page, 25);

  return (
    <section className="flex flex-col gap-8">
      <PageHeaderActions
        title="Orders"
        description="Sales orders linked to Pipedrive deals. Invoice and shipment tracking only — no accounting PDF generation."
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No orders yet. Log one from a deal detail page.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ order, companyName, productName, dealTitle }) => (
                <tr key={order.id}>
                  <td className="px-3 py-2">{order.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">{companyName}</td>
                  <td className="px-3 py-2">
                    {order.dealId ? (
                      <Link
                        href={`/customers/deals/${order.dealId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {dealTitle ?? "Deal"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{productName ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {order.qty != null ? order.qty.toLocaleString("de-DE") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`/orders?page=${page - 1}`}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Prev
          </Link>
        ) : null}
        {rows.length >= 25 ? (
          <Link
            href={`/orders?page=${page + 1}`}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Next
          </Link>
        ) : null}
      </div>
    </section>
  );
}
