import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { distributors, priceSnapshots } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { fetchEcbEuroRates, toEuroCents } from "@/lib/fx/ecb";
import type { PriceProvider, PriceResult } from "@/lib/pricing-providers/types";

import type { CostPartOffer } from "./compute-cost-run";

const CHINA_RE = /china|cn\b|prc|shenzhen|hong\s*kong/i;

export type SnapshotPricesResult = {
  offers: CostPartOffer[];
  snapshotCount: number;
  skippedUnapproved: number;
  errors: string[];
};

/**
 * Fetches provider offers, persists price_snapshots for approved (China-free)
 * distributors, and returns EUR-cent offers for the cost engine.
 */
export async function snapshotProviderPrices(options: {
  mpns: string[];
  providers: PriceProvider[];
  actorId: string | null;
}): Promise<SnapshotPricesResult> {
  if (options.mpns.length === 0) {
    return { offers: [], snapshotCount: 0, skippedUnapproved: 0, errors: [] };
  }

  const errors: string[] = [];
  let rates: Record<string, number> = { EUR: 1 };
  try {
    rates = (await fetchEcbEuroRates()).rates;
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to load ECB rates.",
    );
  }

  const raw: PriceResult[] = [];
  for (const provider of options.providers) {
    try {
      const batch = await provider.fetch(options.mpns);
      raw.push(...batch);
    } catch (error) {
      errors.push(
        `${provider.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (raw.length === 0) {
    return { offers: [], snapshotCount: 0, skippedUnapproved: 0, errors };
  }

  const persist = async (
    db: ReturnType<typeof getDb> | Parameters<Parameters<typeof withActor>[1]>[0],
  ) => {
    const existing = await db.select().from(distributors);
    const byName = new Map(existing.map((d) => [d.name.toLowerCase(), d]));

    const offers: CostPartOffer[] = [];
    let snapshotCount = 0;
    let skippedUnapproved = 0;

    for (const result of raw) {
      const nameKey = result.distributorName.toLowerCase();
      let distributor = byName.get(nameKey);

      if (!distributor) {
        const country = result.country?.toUpperCase() ?? null;
        const looksChina =
          country === "CN" ||
          country === "HK" ||
          CHINA_RE.test(result.distributorName);
        const [created] = await db
          .insert(distributors)
          .values({
            name: result.distributorName,
            country,
            approved: !looksChina,
            apiProvider: "nexar",
          })
          .onConflictDoNothing({ target: distributors.name })
          .returning();
        if (created) {
          distributor = created;
          byName.set(nameKey, created);
        } else {
          const [again] = await db
            .select()
            .from(distributors)
            .where(eq(distributors.name, result.distributorName))
            .limit(1);
          distributor = again;
          if (again) byName.set(nameKey, again);
        }
      }

      if (!distributor) {
        skippedUnapproved++;
        continue;
      }

      if (!distributor.approved) {
        skippedUnapproved++;
        continue;
      }

      const breaks: Record<string, number> = {};
      for (const br of result.priceBreaks) {
        const cents = toEuroCents(br.unitPrice, result.currency, rates);
        if (cents == null) continue;
        // Store EUR unit amount (euros) in jsonb; cost engine uses cents.
        breaks[String(br.qty)] = cents / 100;
        offers.push({
          mpn: result.mpn,
          qty: br.qty,
          unitPriceCents: cents,
          validUntil: null,
          stock: result.stock,
          lifecycle: result.lifecycle,
          source: "api",
        });
      }

      if (Object.keys(breaks).length === 0) continue;

      await db.insert(priceSnapshots).values({
        mpn: result.mpn,
        distributorId: distributor.id,
        fetchedAt: result.fetchedAt,
        currency: "EUR",
        priceBreaks: breaks,
        stock: result.stock,
        factoryLeadDays: result.factoryLeadDays,
        lifecycle: result.lifecycle,
        url: result.productUrl,
      });
      snapshotCount++;
    }

    return { offers, snapshotCount, skippedUnapproved };
  };

  const persisted = options.actorId
    ? await withActor(options.actorId, (tx) => persist(tx))
    : await persist(getDb());

  return { ...persisted, errors };
}
