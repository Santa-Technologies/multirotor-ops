import type { CostRunTier } from "@/db/schema/costs";

export type CostBomLine = {
  mpn: string;
  qtyPerBoard: number;
};

export type CostManualQuote = {
  mpn: string;
  qty: number;
  unitPriceCents: number;
  /** ISO date YYYY-MM-DD; null means no expiry. */
  validUntil: string | null;
};

export type CostAssemblyPrice = {
  qtyTier: number;
  unitPriceCents: number;
  setupCostCents: number;
  validUntil: string | null;
};

export type CostRunFlag = {
  code: "missing" | "stale" | "assembly_missing" | "assembly_stale";
  mpn?: string;
  detail?: string;
};

export type ComputeCostRunInput = {
  lines: CostBomLine[];
  manualQuotes: CostManualQuote[];
  assemblyPrices: CostAssemblyPrice[];
  /** Board quantities to price (usually the cost-factor keys). */
  boardTiers: number[];
  /** "Today" as YYYY-MM-DD for expiry checks. */
  asOfDate: string;
};

export type ComputeCostRunResult = {
  tiers: Record<string, CostRunTier>;
  flags: CostRunFlag[];
  coveragePct: number;
};

/** True when validUntil is set and strictly before asOfDate. */
function isExpired(validUntil: string | null, asOfDate: string) {
  return validUntil !== null && validUntil < asOfDate;
}

/**
 * Picks the cheapest manual quote whose break qty fits the needed part qty.
 * Falls back to the cheapest quote overall when none fit.
 */
function pickPartQuote(
  quotes: CostManualQuote[],
  neededQty: number,
  asOfDate: string,
): { quote: CostManualQuote; stale: boolean } | null {
  if (quotes.length === 0) return null;

  const fitting = quotes.filter((q) => q.qty <= neededQty);
  const pool = fitting.length > 0 ? fitting : quotes;
  const quote = pool.reduce((best, q) =>
    q.unitPriceCents < best.unitPriceCents ? q : best,
  );
  return { quote, stale: isExpired(quote.validUntil, asOfDate) };
}

/** Picks assembly for a board tier: exact tier, else nearest lower, else cheapest. */
function pickAssembly(
  prices: CostAssemblyPrice[],
  boardQty: number,
  asOfDate: string,
): { price: CostAssemblyPrice; stale: boolean } | null {
  if (prices.length === 0) return null;
  const exact = prices.find((p) => p.qtyTier === boardQty);
  const lower = prices
    .filter((p) => p.qtyTier <= boardQty)
    .sort((a, b) => b.qtyTier - a.qtyTier)[0];
  const price = exact ?? lower ?? prices.reduce((best, p) =>
    p.unitPriceCents < best.unitPriceCents ? p : best,
  );
  return { price, stale: isExpired(price.validUntil, asOfDate) };
}

/**
 * Builds per-tier material + assembly costs from BOM lines and manual prices.
 * Coverage is the share of BOM lines that had at least one manual quote.
 * Pure: no I/O.
 */
export function computeCostRun(input: ComputeCostRunInput): ComputeCostRunResult {
  const flags: CostRunFlag[] = [];
  const byMpn = new Map<string, CostManualQuote[]>();
  for (const q of input.manualQuotes) {
    const key = q.mpn.toLowerCase();
    const list = byMpn.get(key) ?? [];
    list.push(q);
    byMpn.set(key, list);
  }

  // First-seen casing per lower(mpn) for stable missing flags.
  const distinctLines = new Map<string, string>();
  for (const line of input.lines) {
    const key = line.mpn.toLowerCase();
    if (!distinctLines.has(key)) distinctLines.set(key, line.mpn);
  }
  let pricedDistinct = 0;
  for (const [key, mpn] of distinctLines) {
    if ((byMpn.get(key) ?? []).length > 0) pricedDistinct++;
    else flags.push({ code: "missing", mpn });
  }
  const coveragePct =
    distinctLines.size === 0
      ? 0
      : Math.round((1000 * pricedDistinct) / distinctLines.size) / 10;

  const tiers: Record<string, CostRunTier> = {};
  let assemblyMissingLogged = false;
  let assemblyStaleLogged = false;

  for (const boardQty of input.boardTiers) {
    let materialCents = 0;
    for (const line of input.lines) {
      const needed = line.qtyPerBoard * boardQty;
      const picked = pickPartQuote(
        byMpn.get(line.mpn.toLowerCase()) ?? [],
        needed,
        input.asOfDate,
      );
      if (!picked) continue;
      materialCents += picked.quote.unitPriceCents * line.qtyPerBoard;
      if (picked.stale) {
        flags.push({
          code: "stale",
          mpn: line.mpn,
          detail: `Quote expired ${picked.quote.validUntil}`,
        });
      }
    }

    const assembly = pickAssembly(input.assemblyPrices, boardQty, input.asOfDate);
    let assemblyCents = 0;
    if (!assembly) {
      if (!assemblyMissingLogged) {
        flags.push({ code: "assembly_missing" });
        assemblyMissingLogged = true;
      }
    } else {
      assemblyCents =
        assembly.price.unitPriceCents +
        Math.ceil(assembly.price.setupCostCents / boardQty);
      if (assembly.stale && !assemblyStaleLogged) {
        flags.push({
          code: "assembly_stale",
          detail: `Assembly quote expired ${assembly.price.validUntil}`,
        });
        assemblyStaleLogged = true;
      }
    }

    tiers[String(boardQty)] = {
      materialCents,
      assemblyCents,
      totalCents: materialCents + assemblyCents,
    };
  }

  // Deduplicate stale flags per MPN (same part flagged once per run).
  const seenStale = new Set<string>();
  const deduped = flags.filter((f) => {
    if (f.code !== "stale" || !f.mpn) return true;
    const key = f.mpn.toLowerCase();
    if (seenStale.has(key)) return false;
    seenStale.add(key);
    return true;
  });

  return { tiers, flags: deduped, coveragePct };
}
