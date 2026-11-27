import type { Metadata } from "next";

import { PageHeaderActions } from "@/components/page-header-actions";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  listFinishedGoodsStock,
  listOpenAssemblyLots,
  listPartStock,
} from "@/lib/inventory/queries";

import {
  CreateLotDialog,
  FinishedGoodsDialog,
  PartStockDialog,
  UpdateLotForm,
} from "./forms";

export const metadata: Metadata = { title: "Inventory" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function InventoryPage() {
  const user = await requireUser();
  const canEdit = canWrite(user.role, "part_inventory", "insert");

  const [partRows, fgRows, openLots] = await Promise.all([
    listPartStock(),
    listFinishedGoodsStock(),
    listOpenAssemblyLots(),
  ]);

  return (
    <section className="flex flex-col gap-10">
      <PageHeaderActions
        title="Inventory"
        description="Parts on the shelf and on order, finished goods, and assembly lots for the weekly review."
        actions={
          canEdit ? (
            <>
              <PartStockDialog />
              <FinishedGoodsDialog />
              <CreateLotDialog />
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Assembly lots (open)</h2>
        {openLots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in assembly yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {openLots.map(({ lot, productName }) => (
              <li
                key={lot.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <span className="font-medium">{productName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {lot.qty.toLocaleString("de-DE")} units ·{" "}
                    {lot.status.replaceAll("_", " ")}
                    {" · ETA "}
                    {formatDate(lot.eta)}
                    {lot.assembler ? ` · ${lot.assembler}` : ""}
                  </span>
                </div>
                {canEdit ? (
                  <UpdateLotForm
                    lot={{
                      id: lot.id,
                      status: lot.status,
                      eta: lot.eta,
                      assembler: lot.assembler,
                      notes: lot.notes,
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Finished goods</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fgRows.map(({ product, stock }) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">{product.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {(stock?.qty ?? 0).toLocaleString("de-DE")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {stock?.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Parts stock</h2>
        {partRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No parts in the catalog yet. Import a BOM first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">MPN</th>
                  <th className="px-3 py-2 font-medium">On hand</th>
                  <th className="px-3 py-2 font-medium">On order</th>
                  <th className="px-3 py-2 font-medium">ETA</th>
                  <th className="px-3 py-2 font-medium">PO</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {partRows.map(({ part, inventory }) => (
                  <tr key={part.id}>
                    <td className="px-3 py-2 font-mono text-xs">{part.mpn}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {(inventory?.onHand ?? 0).toLocaleString("de-DE")}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {(inventory?.onOrderQty ?? 0).toLocaleString("de-DE")}
                    </td>
                    <td className="px-3 py-2">{formatDate(inventory?.eta ?? null)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {inventory?.poRef ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
