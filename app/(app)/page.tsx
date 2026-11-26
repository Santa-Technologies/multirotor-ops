import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { costRuns, products, quotes } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { formatEuroCents, formatPct } from "@/lib/format/money";
import { getInventoryDashboardSnapshot } from "@/lib/inventory/queries";

export const metadata: Metadata = { title: "Dashboard" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function DashboardPage() {
  await requireUser();
  const db = getDb();
  const inventory = await getInventoryDashboardSnapshot();

  const [latestPilotCost] = await db
    .select({
      runAt: costRuns.runAt,
      coveragePct: costRuns.coveragePct,
      tiers: costRuns.tiers,
      productName: products.name,
    })
    .from(costRuns)
    .innerJoin(products, eq(products.id, costRuns.productId))
    .where(eq(products.name, "Pilot H743"))
    .orderBy(desc(costRuns.runAt))
    .limit(1);

  const draftQuotes = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      quantity: quotes.quantity,
      productName: products.name,
      outputs: quotes.outputs,
    })
    .from(quotes)
    .innerJoin(products, eq(products.id, quotes.productId))
    .where(eq(quotes.status, "draft"))
    .orderBy(desc(quotes.createdAt))
    .limit(5);

  const tier1000 = latestPilotCost?.tiers["1000"];

  return (
    <section className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly ops snapshot: stock, assembly timeline, cost freshness and open drafts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Finished goods"
          value={inventory.finishedGoodsTotal.toLocaleString("de-DE")}
          hint={`${inventory.finishedGoodsVariants} variant(s)`}
        />
        <Stat
          label="Parts on order"
          value={inventory.partsOnOrderLines.toLocaleString("de-DE")}
          hint={`${inventory.partInventoryRows} stock row(s)`}
        />
        <Stat
          label="Open assembly lots"
          value={inventory.openLotCount.toLocaleString("de-DE")}
          hint={`${inventory.dueSoon.length} due within 14 days`}
        />
        <Stat
          label="Pilot cost @ 1k"
          value={tier1000 ? formatEuroCents(tier1000.totalCents) : "—"}
          hint={
            latestPilotCost
              ? `${latestPilotCost.runAt.toLocaleDateString("de-DE")} · ${formatPct(Number(latestPilotCost.coveragePct))} coverage`
              : "No cost run yet"
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Assembly timeline</h2>
            <Link href="/inventory" className="text-xs underline-offset-4 hover:underline">
              Inventory
            </Link>
          </div>
          {inventory.openLots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open assembly lots.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {inventory.openLots.map(({ lot, productName }) => (
                <li key={lot.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <span>
                    <span className="font-medium">{productName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {lot.qty.toLocaleString("de-DE")} ·{" "}
                      {lot.status.replaceAll("_", " ")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ETA {formatDate(lot.eta)}
                    {lot.assembler ? ` · ${lot.assembler}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Recent internal drafts</h2>
            <Link href="/quotes" className="text-xs underline-offset-4 hover:underline">
              Quotes
            </Link>
          </div>
          {draftQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drafts yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {draftQuotes.map((d) => {
                const outputs = d.outputs as {
                  low?: { unitPriceCents?: number };
                  high?: { unitPriceCents?: number };
                };
                return (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="font-medium">{d.number}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {d.productName} · {d.quantity.toLocaleString("de-DE")}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {outputs.low?.unitPriceCents != null &&
                      outputs.high?.unitPriceCents != null
                        ? `${formatEuroCents(outputs.low.unitPriceCents)} – ${formatEuroCents(outputs.high.unitPriceCents)}`
                        : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
