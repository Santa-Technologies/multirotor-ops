import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  listCompaniesWithContactCounts,
  listOpenPipedriveDeals,
} from "@/lib/requests/queries";

import { SyncPipedriveForm } from "./forms";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const user = await requireUser();
  const canSync = canWrite(user.role, "pipedrive_deals", "insert");

  const [companyGroups, deals] = await Promise.all([
    listCompaniesWithContactCounts(),
    listOpenPipedriveDeals(50),
  ]);

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Local companies and contacts, enriched from Pipedrive. Enough to attach
            requests without perfect CRM hygiene.
          </p>
        </div>
        {canSync ? <SyncPipedriveForm /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Open Pipedrive deals</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mirrored open deals yet. Run a Pipedrive refresh when the API token is set.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Deal</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Pipeline / stage</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deals.map(({ deal, companyName }) => (
                  <tr key={deal.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{deal.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · PD #{deal.pipedriveId}
                      </span>
                    </td>
                    <td className="px-3 py-2">{companyName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[deal.pipelineName, deal.stageName].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {deal.valueAmount != null
                        ? `${Number(deal.valueAmount).toLocaleString("de-DE", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })} ${deal.currency}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Companies</h2>
        {companyGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No companies yet. Add one on Requests or sync from Pipedrive.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {companyGroups.map(({ company, contacts }) => (
              <li key={company.id} className="px-4 py-3">
                <div className="text-sm font-medium">
                  {company.name}
                  {company.pipedriveId != null ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      PD org #{company.pipedriveId}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[company.country, company.website].filter(Boolean).join(" · ") ||
                    "No country / website"}
                </p>
                {contacts.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {contacts.map((c) => (
                      <li key={c.id}>
                        {c.name}
                        {c.email ? ` · ${c.email}` : ""}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No contacts</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
