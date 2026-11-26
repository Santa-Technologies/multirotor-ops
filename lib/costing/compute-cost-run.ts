import type { CostRunTier } from "@/db/schema/costs";

export type CostBomLine = {
  mpn: string;
  qtyPerBoard: number;
};

/** Unified offer from a manual quote or an approved distributor API snapshot. */
export type CostPartOffer = {
  mpn: string;
  qty: number;
  unitPriceCents: number;
  /** ISO date YYYY-MM-DD; null means no expiry (API snapshots use null). */
  validUntil: string | null;
  stock?: number | null;
  lifecycle?: string | null;
  source?: "manual" | "api";
};

/** @deprecated Prefer CostPartOffer; kept as an alias for call sites. */
export type CostManualQuote = CostPartOffer;

export type CostAssemblyPrice = {
  qtyTier: number;
  unitPriceCents: number;
  setupCostCents: number;
  validUntil: string | null;
};

export type CostRunFlag = {
  code:
    | "missing"
    | "stale"
    | "assembly_missing"
    | "assembly_stale"
    | "low_stock"
    | "eol";
  mpn?: string;
  detail?: string;
};

export type ComputeCostRunInput = {
  lines: CostBomLine[];
  /** Merged manual + API offers; cheapest fitting break wins. */
  manualQuotes: CostPartOffer[];
  assemblyPrices: CostAssemblyPrice[];
  boardTiers: number[];
  asOfDate: string;
};

export type ComputeCostRunResult = {
  tiers: Record<string, CostRunTier>;
  flags: CostRunFlag[];
  coveragePct: number;
};

const EOL_RE = /\b(eol|nrnd|obsolete|end[\s_-]?of[\s_-]?life)\b/i;

/** True when validUntil is set and strictly before asOfDate. */
function isExpired(validUntil: string | null, asOfDate: string) {
  return validUntil !== null && validUntil < asOfDate;
}

/**
 * Picks the cheapest offer whose break qty fits the needed part qty.
 * Falls back to the cheapest offer overall when none fit.
 */
function pickPartOffer(
  offers: CostPartOffer[],
  neededQty: number,
  asOfDate: string,
): { offer: CostPartOffer; stale: boolean } | null {
  if (offers.length === 0) return null;

  const fitting = offers.filter((q) => q.qty <= neededQty);
  const pool = fitting.length > 0 ? fitting : offers;
  const offer = pool.reduce((best, q) =>
    q.unitPriceCents < best.unitPriceCents ? q : best,
  );
  return { offer, stale: isExpired(offer.validUntil, asOfDate) };
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
  const price =
    exact ??
    lower ??
    prices.reduce((best, p) =>
      p.unitPriceCents < best.unitPriceCents ? p : best,
    );
  return { price, stale: isExpired(price.validUntil, asOfDate) };
}

/**
 * Builds per-tier material + assembly costs from BOM lines and part offers
 * (manual quotes and/or approved API snapshots). Coverage is the share of
 * distinct MPNs that had at least one offer. Pure: no I/O.
 */
export function computeCostRun(input: ComputeCostRunInput): ComputeCostRunResult {
  const flags: CostRunFlag[] = [];
  const byMpn = new Map<string, CostPartOffer[]>();
  for (const q of input.manualQuotes) {
    const key = q.mpn.toLowerCase();
    const list = byMpn.get(key) ?? [];
    list.push(q);
    byMpn.set(key, list);
  }

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
  const seenLowStock = new Set<string>();
  const seenEol = new Set<string>();
  const seenStale = new Set<string>();

  for (const boardQty of input.boardTiers) {
    let materialCents = 0;
    for (const line of input.lines) {
      const needed = line.qtyPerBoard * boardQty;
      const picked = pickPartOffer(
        byMpn.get(line.mpn.toLowerCase()) ?? [],
        needed,
        input.asOfDate,
      );
      if (!picked) continue;
      materialCents += picked.offer.unitPriceCents * line.qtyPerBoard;

      const mpnKey = line.mpn.toLowerCase();
      if (picked.stale && !seenStale.has(mpnKey)) {
        seenStale.add(mpnKey);
        flags.push({
          code: "stale",
          mpn: line.mpn,
          detail: `Quote expired ${picked.offer.validUntil}`,
        });
      }
      if (
        picked.offer.stock != null &&
        picked.offer.stock < needed &&
        !seenLowStock.has(mpnKey)
      ) {
        seenLowStock.add(mpnKey);
        flags.push({
          code: "low_stock",
          mpn: line.mpn,
          detail: `Stock ${picked.offer.stock} < need ${needed} at ${boardQty} boards`,
        });
      }
      if (
        picked.offer.lifecycle &&
        EOL_RE.test(picked.offer.lifecycle) &&
        !seenEol.has(mpnKey)
      ) {
        seenEol.add(mpnKey);
        flags.push({
          code: "eol",
          mpn: line.mpn,
          detail: picked.offer.lifecycle,
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

  return { tiers, flags, coveragePct };
}
