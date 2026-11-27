import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { getDealDetail } from "@/lib/customers/queries";

import { DealDetailView } from "./deal-detail";

type PageProps = { params: Promise<{ dealId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  return { title: detail ? detail.deal.title : "Deal" };
}

/** Full-page deal detail (hard navigation / shared URL refresh). */
export default async function DealDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  if (!detail) notFound();

  const canRequest = canWrite(user.role, "requests", "insert");
  const canOrder = canWrite(user.role, "sales_orders", "insert");
  const canInvoice = canWrite(user.role, "sales_invoices", "insert");
  const canShip = canWrite(user.role, "sales_shipments", "update");

  return (
    <DealDetailView
      detail={detail}
      canRequest={canRequest}
      canOrder={canOrder}
      canInvoice={canInvoice}
      canShip={canShip}
    />
  );
}
