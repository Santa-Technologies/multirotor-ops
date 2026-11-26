import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { parts } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  listActiveSuppliers,
  listOpenRfqThreads,
  listPendingRfqOffers,
} from "@/lib/rfq/queries";

import { ConfirmOfferForm, CreateSupplierForm, SendRfqForm } from "./forms";

export const metadata: Metadata = { title: "Supplier RFQ" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function RfqPage() {
  const user = await requireUser();
  const canSupply = canWrite(user.role, "suppliers", "insert");
  const canSend = canWrite(user.role, "rfq_threads", "insert");
  const canConfirm = canWrite(user.role, "rfq_offers", "update");

  const db = getDb();
  const [supplierRows, openThreads, pendingOffers, partRows] = await Promise.all([
    listActiveSuppliers(),
    listOpenRfqThreads(),
    listPendingRfqOffers(),
    db
      .select({ id: parts.id, mpn: parts.mpn })
      .from(parts)
      .orderBy(asc(parts.mpn))
      .limit(500),
  ]);

  return (
    <section className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Supplier RFQ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deduped price requests by part. Inbound PDF replies are parsed for review —
          nothing is written to cost until you confirm.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Pending confirmations</h2>
        {pendingOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offers waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pendingOffers.map(({ offer, mpn, supplierName, thread }) => (
              <li key={offer.id}>
                <div className="mb-2 text-sm">
                  <span className="font-medium font-mono text-xs">{mpn}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {supplierName} · {thread.subjectToken}
                    {offer.sourceFilename ? ` · ${offer.sourceFilename}` : ""}
                  </span>
                </div>
                {canConfirm ? (
                  <ConfirmOfferForm
                    offer={{
                      id: offer.id,
                      qty: offer.qty,
                      unitPriceCents: offer.unitPriceCents,
                      validUntil: offer.validUntil,
                      stock: offer.stock,
                      currency: offer.currency,
                      parseNotes: offer.parseNotes,
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Supply must confirm this offer.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Open RFQs</h2>
        {openThreads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open RFQs.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Token</th>
                  <th className="px-3 py-2 font-medium">MPN</th>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {openThreads.map(({ thread, mpn, supplierName }) => (
                  <tr key={thread.id}>
                    <td className="px-3 py-2 font-mono text-xs">{thread.subjectToken}</td>
                    <td className="px-3 py-2 font-mono text-xs">{mpn}</td>
                    <td className="px-3 py-2">{supplierName}</td>
                    <td className="px-3 py-2">
                      {thread.qtyRequested.toLocaleString("de-DE")}
                    </td>
                    <td className="px-3 py-2">{thread.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">{formatDate(thread.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canSend ? (
        <SendRfqForm
          parts={partRows}
          suppliers={supplierRows.map((s) => ({ id: s.id, name: s.name }))}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Suppliers</h2>
        {supplierRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suppliers yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {supplierRows.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground"> · {s.email}</span>
                {s.notes ? (
                  <span className="text-muted-foreground"> · {s.notes}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canSupply ? <CreateSupplierForm /> : null}
      </div>
    </section>
  );
}
