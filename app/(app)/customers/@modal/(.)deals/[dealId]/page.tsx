import { notFound } from "next/navigation";

import { DealModal } from "@/components/deal-modal";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { getDealDetail } from "@/lib/customers/queries";

import { DealDetailView } from "../../../deals/[dealId]/deal-detail";

type PageProps = { params: Promise<{ dealId: string }> };

/**
 * Soft-nav intercept: deal detail as a dialog over the customers kanban.
 * Hard refresh / direct URL still hits the full page under deals/[dealId].
 */
export default async function InterceptedDealPage({ params }: PageProps) {
  const user = await requireUser();
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  if (!detail) notFound();

  const { deal } = detail;
  const canRequest = canWrite(user.role, "requests", "insert");
  const canOrder = canWrite(user.role, "sales_orders", "insert");
  const canInvoice = canWrite(user.role, "sales_invoices", "insert");
  const canShip = canWrite(user.role, "sales_shipments", "update");

  return (
    <DealModal
      title={deal.title}
      description={`${deal.pipelineName ?? "Pipeline"} · ${deal.stageName ?? "No stage"} · PD #${deal.pipedriveId}`}
    >
      <DealDetailView
        detail={detail}
        canRequest={canRequest}
        canOrder={canOrder}
        canInvoice={canInvoice}
        canShip={canShip}
        variant="modal"
      />
    </DealModal>
  );
}
