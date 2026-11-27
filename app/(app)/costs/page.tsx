import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { PageHeaderActions } from "@/components/page-header-actions";
import { getDb } from "@/db";
import { costRuns, products } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { formatEuroCents, formatPct } from "@/lib/format/money";

import {
  AssemblyPriceDialog,
  ManualQuoteDialog,
  RunCostDialog,
} from "./cost-forms";
import { MissingPartsRfqPanel } from "./missing-rfq";

export const metadata: Metadata = { title: "Costs" };

export default async function CostsPage() {
  const user = await requireUser();
  const db = getDb();

  const latestRuns = await db
    .select({
      id: costRuns.id,
      runAt: costRuns.runAt,
      coveragePct: costRuns.coveragePct,
      tiers: costRuns.tiers,
      flags: costRuns.flags,
      productName: products.name,
      productId: products.id,
    })
    .from(costRuns)
    .innerJoin(products, eq(products.id, costRuns.productId))
    .orderBy(desc(costRuns.runAt))
    .limit(10);

  const canRun = canWrite(user.role, "cost_runs", "insert");
  const canSupply = canWrite(user.role, "manual_quotes", "insert");
  const canRfq = canWrite(user.role, "rfq_threads", "insert");

  const latestWithMissing = latestRuns.find(
    (run) =>
      Array.isArray(run.flags) &&
      run.flags.some((f) => (f as { code?: string }).code === "missing"),
  );

  return (
    <section className="flex flex-col gap-10">
      <PageHeaderActions
        title="Costs"
        description="Cost per board by volume tier from BOM material, approved distributor API prices (Nexar when configured) and assembly quotes. Weekly cron Monday 06:00 CET."
        actions={
          <>
            {canRun ? <RunCostDialog /> : null}
            {canSupply ? <ManualQuoteDialog /> : null}
            {canSupply ? <AssemblyPriceDialog /> : null}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Latest cost runs</h2>
        {latestRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cost runs yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {latestRuns.map((run) => {
              const tierEntries = Object.entries(run.tiers).sort(
                (a, b) => Number(a[0]) - Number(b[0]),
              );
              return (
                <li key={run.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{run.productName}</span>
                    <span className="text-xs text-muted-foreground">
                      {run.runAt.toLocaleString("de-DE")} · coverage{" "}
                      {formatPct(Number(run.coveragePct))}
                    </span>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="pr-3 font-medium">Tier</th>
                          <th className="pr-3 font-medium">Material</th>
                          <th className="pr-3 font-medium">Assembly</th>
                          <th className="font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tierEntries.map(([qty, tier]) => (
                          <tr key={qty}>
                            <td className="pr-3 py-0.5 tabular-nums">{qty}</td>
                            <td className="pr-3 py-0.5">
                              {formatEuroCents(tier.materialCents)}
                            </td>
                            <td className="pr-3 py-0.5">
                              {formatEuroCents(tier.assemblyCents)}
                            </td>
                            <td className="py-0.5">
                              {formatEuroCents(tier.totalCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {Array.isArray(run.flags) && run.flags.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Flags:{" "}
                      {run.flags
                        .map((f) => {
                          const flag = f as { code?: string; mpn?: string };
                          return flag.mpn
                            ? `${flag.code} (${flag.mpn})`
                            : String(flag.code ?? "flag");
                        })
                        .join(", ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canRfq && latestWithMissing ? (
        <MissingPartsRfqPanel
          costRunId={latestWithMissing.id}
          productName={latestWithMissing.productName}
          flags={latestWithMissing.flags as Array<Record<string, unknown>>}
        />
      ) : null}
    </section>
  );
}
