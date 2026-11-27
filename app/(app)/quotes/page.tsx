import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { costRuns, products, quoteSettings, quotes } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { formatEuroCents } from "@/lib/format/money";
import { toPricingSettings } from "@/lib/quotes/settings";

import {
  PricingPlayground,
  type PlaygroundProduct,
  type SerializedCostRun,
} from "./playground";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const user = await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      product: products,
      settings: quoteSettings,
    })
    .from(products)
    .innerJoin(quoteSettings, eq(quoteSettings.productId, products.id))
    .where(eq(products.pricingMode, "cost_plus"))
    .orderBy(products.name);

  const playgroundProducts: PlaygroundProduct[] = [];
  for (const row of rows) {
    const [latest] = await db
      .select()
      .from(costRuns)
      .where(eq(costRuns.productId, row.product.id))
      .orderBy(desc(costRuns.runAt))
      .limit(1);

    let costRun: SerializedCostRun | null = null;
    if (latest) {
      const tiers: SerializedCostRun["tiers"] = {};
      for (const [qty, tier] of Object.entries(latest.tiers)) {
        tiers[qty] = { totalCents: tier.totalCents };
      }
      costRun = {
        runAt: latest.runAt.toISOString(),
        coveragePct: Number(latest.coveragePct),
        tiers,
        lineFlags: [],
      };
    }

    playgroundProducts.push({
      id: row.product.id,
      name: row.product.name,
      settings: toPricingSettings(row.settings),
      costRunId: latest?.id ?? null,
      costRun,
    });
  }

  const recent = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      version: quotes.version,
      quantity: quotes.quantity,
      status: quotes.status,
      approvalStatus: quotes.approvalStatus,
      createdAt: quotes.createdAt,
      sentAt: quotes.sentAt,
      productName: products.name,
      outputs: quotes.outputs,
    })
    .from(quotes)
    .innerJoin(products, eq(products.id, quotes.productId))
    .orderBy(desc(quotes.createdAt))
    .limit(30);

  const canSave = canWrite(user.role, "quotes", "insert");

  return (
    <section className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Quotes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Playground drafts stay indicative/internal. Open a draft to approve, download
          PDF and mark sent for the customer.{" "}
          <Link href="/costs" className="underline-offset-4 hover:underline">
            Costs
          </Link>{" "}
          feed the latest cost run when coverage is high enough.
        </p>
      </div>

      {canSave ? (
        <PricingPlayground products={playgroundProducts} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your role can view quotes but not save new scenarios.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Recent quotes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {recent.map((d) => {
              const outputs = d.outputs as {
                low?: { unitPriceCents?: number };
                high?: { unitPriceCents?: number };
              };
              const low = outputs.low?.unitPriceCents;
              const high = outputs.high?.unitPriceCents;
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                >
                  <span>
                    <Link
                      href={`/quotes/${d.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {d.number}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · v{d.version} · {d.status}
                      {d.approvalStatus === "pending" ? " · needs approval" : ""}
                      {" · "}
                      {d.productName} · {d.quantity.toLocaleString("de-DE")} units
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {low != null && high != null
                      ? `${formatEuroCents(low)} – ${formatEuroCents(high)}`
                      : "—"}
                    {" · "}
                    {(d.sentAt ?? d.createdAt).toLocaleString("de-DE")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
