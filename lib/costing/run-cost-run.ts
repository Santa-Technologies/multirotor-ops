import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  assemblyPrices,
  bomLines,
  bomVersions,
  costRuns,
  manualQuotes,
  parts,
  products,
  quoteSettings,
} from "@/db/schema";
import { withActor } from "@/db/with-actor";

import { computeCostRun } from "./compute-cost-run";

export type RunCostRunResult = {
  costRunId: string;
  coveragePct: number;
  flagCount: number;
};

/**
 * Loads the current BOM, manual quotes and assembly prices for a variant,
 * computes tier costs, and inserts a cost_runs row.
 */
export async function runCostRunForProduct(
  productId: string,
  actorId: string,
): Promise<RunCostRunResult> {
  const db = getDb();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new Error("Product not found.");

  const [bom] = await db
    .select()
    .from(bomVersions)
    .where(and(eq(bomVersions.productId, productId), eq(bomVersions.isCurrent, true)))
    .limit(1);
  if (!bom) throw new Error("No current BOM for this product. Import a BOM first.");

  const [settings] = await db
    .select()
    .from(quoteSettings)
    .where(eq(quoteSettings.productId, productId))
    .limit(1);

  const boardTiers = settings
    ? Object.keys(settings.costFactors)
        .map((k) => Number.parseInt(k, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)
    : [100, 1000, 5000, 10_000, 20_000];

  const lines = await db
    .select({
      mpn: parts.mpn,
      qtyPerBoard: bomLines.qtyPerBoard,
    })
    .from(bomLines)
    .innerJoin(parts, eq(parts.id, bomLines.partId))
    .where(eq(bomLines.bomVersionId, bom.id));

  const mpnSet = new Set(lines.map((l) => l.mpn.toLowerCase()));
  const allPartQuotes = await db
    .select({
      mpn: manualQuotes.mpn,
      qty: manualQuotes.qty,
      unitPriceCents: manualQuotes.unitPriceCents,
      validUntil: manualQuotes.validUntil,
    })
    .from(manualQuotes)
    .where(isNotNull(manualQuotes.mpn));
  const quotes = allPartQuotes.filter(
    (q) => q.mpn != null && mpnSet.has(q.mpn.toLowerCase()),
  );

  const assemblies = await db
    .select({
      qtyTier: assemblyPrices.qtyTier,
      unitPriceCents: assemblyPrices.unitPriceCents,
      setupCostCents: assemblyPrices.setupCostCents,
      validUntil: assemblyPrices.validUntil,
    })
    .from(assemblyPrices)
    .where(eq(assemblyPrices.productId, productId))
    .orderBy(desc(assemblyPrices.quotedAt));

  const asOfDate = new Date().toISOString().slice(0, 10);
  const computed = computeCostRun({
    lines,
    manualQuotes: quotes
      .filter((q): q is typeof q & { mpn: string } => q.mpn != null)
      .map((q) => ({
        mpn: q.mpn,
        qty: q.qty,
        unitPriceCents: q.unitPriceCents,
        validUntil: q.validUntil,
      })),
    assemblyPrices: assemblies,
    boardTiers,
    asOfDate,
  });

  const [inserted] = await withActor(actorId, async (tx) =>
    tx
      .insert(costRuns)
      .values({
        productId,
        bomVersionId: bom.id,
        tiers: computed.tiers,
        flags: computed.flags,
        coveragePct: computed.coveragePct,
      })
      .returning({ id: costRuns.id }),
  );

  return {
    costRunId: inserted!.id,
    coveragePct: computed.coveragePct,
    flagCount: computed.flags.length,
  };
}
