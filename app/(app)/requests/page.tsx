import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  listCompaniesForSelect,
  listContactsForSelect,
  listOpenPipedriveDeals,
  listRequests,
  listUsersForOwnerSelect,
} from "@/lib/requests/queries";

import {
  CreateCompanyForm,
  CreateContactForm,
  CreateRequestForm,
  TriageRequestForm,
} from "./forms";

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
  const canCompanies = canWrite(user.role, "companies", "insert");

  const db = getDb();
  const [rows, companyOpts, contactOpts, ownerOpts, dealRows, productList] =
    await Promise.all([
      listRequests(),
      listCompaniesForSelect(),
      listContactsForSelect(),
      listUsersForOwnerSelect(),
      listOpenPipedriveDeals(100),
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .orderBy(asc(products.name)),
    ]);

  const companies = companyOpts.map((c) => ({ id: c.id, label: c.name }));
  const contacts = contactOpts.map((c) => ({
    id: c.id,
    label: c.name,
    companyId: c.companyId,
  }));
  const owners = ownerOpts.map((o) => ({
    id: o.id,
    label: o.name?.trim() || o.email,
  }));
  const productOptions = productList.map((p) => ({ id: p.id, label: p.name }));
  const deals = dealRows.map(({ deal }) => ({
    id: String(deal.pipedriveId),
    label: `${deal.title}${deal.stageName ? ` · ${deal.stageName}` : ""}`,
  }));

  return (
    <section className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lightweight work items for Marc and the team. Optional Pipedrive deal link —
          not every request lives in the CRM.
        </p>
      </div>

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
                    <TriageRequestForm
                      request={{
                        id: request.id,
                        status: request.status,
                        ownerId: request.ownerId,
                        dueDate: request.dueDate,
                        productId: request.productId,
                        urgency: request.urgency,
                        pipedriveDealId: request.pipedriveDealId,
                      }}
                      owners={owners}
                      products={productOptions}
                      deals={deals}
                    />
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {canCreate ? (
        <CreateRequestForm
          companies={companies}
          contacts={contacts}
          products={productOptions}
          owners={owners}
          deals={deals}
        />
      ) : null}

      {canCompanies ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CreateCompanyForm />
          <CreateContactForm companies={companies} />
        </div>
      ) : null}
    </section>
  );
}
