import type { Metadata } from "next";

import { PageHeaderActions } from "@/components/page-header-actions";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { listRequests } from "@/lib/requests/queries";

import { CreateRequestDialog, TriageRequestDialog } from "./forms";

export const metadata: Metadata = { title: "Requests" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function RequestsPage() {
  const user = await requireUser();
  const canCreate = canWrite(user.role, "requests", "insert");
  const canTriage = canWrite(user.role, "requests", "update");

  const rows = await listRequests();

  return (
    <section className="flex flex-col gap-10">
      <PageHeaderActions
        title="Requests"
        description="Product variation and tech work items. Companies and contacts come from Pipedrive — sync on Customers. Sales orders live under the deal, not here."
        actions={canCreate ? <CreateRequestDialog /> : null}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">All requests</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(
              ({
                request,
                companyName,
                contactName,
                ownerName,
                ownerEmail,
                productName,
              }) => (
                <li key={request.id} className="rounded-lg border px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{request.summary}</span>
                    <span className="text-xs text-muted-foreground">
                      {request.status.replaceAll("_", " ")}
                      {request.urgency ? ` · ${request.urgency}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {companyName}
                    {contactName ? ` · ${contactName}` : ""}
                    {productName ? ` · ${productName}` : ""}
                    {" · "}
                    {request.type.replaceAll("_", " ")}
                    {request.quantity
                      ? ` · qty ${request.quantity.toLocaleString("de-DE")}`
                      : ""}
                    {" · due "}
                    {formatDate(request.dueDate)}
                    {" · owner "}
                    {ownerName?.trim() || ownerEmail || "—"}
                    {request.pipedriveDealId != null
                      ? ` · PD #${request.pipedriveDealId}`
                      : ""}
                  </p>
                  {request.rawText ? (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                      {request.rawText}
                    </pre>
                  ) : null}
                  {canTriage ? (
                    <div className="mt-3">
                      <TriageRequestDialog
                        request={{
                          id: request.id,
                          status: request.status,
                          ownerId: request.ownerId,
                          dueDate: request.dueDate,
                          productId: request.productId,
                          productLabel: productName,
                          urgency: request.urgency,
                          dealId: request.dealId,
                          pipedriveDealId: request.pipedriveDealId,
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
