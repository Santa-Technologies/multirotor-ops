import type { PriceProvider, PriceResult } from "./types";

/**
 * In-memory provider for tests. Returns fixed EUR offers for configured MPNs.
 */
export function createMockPriceProvider(
  catalog: Record<
    string,
    {
      distributorName?: string;
      country?: string | null;
      breaks: Array<{ qty: number; unitPrice: number }>;
      stock?: number | null;
      lifecycle?: string | null;
    }
  >,
): PriceProvider {
  return {
    name: "mock",
    async fetch(mpns: string[]): Promise<PriceResult[]> {
      const now = new Date();
      const out: PriceResult[] = [];
      for (const mpn of mpns) {
        const entry = catalog[mpn] ?? catalog[mpn.toUpperCase()];
        if (!entry) continue;
        out.push({
          mpn,
          distributorName: entry.distributorName ?? "Mock Distributor",
          country: entry.country ?? "DE",
          currency: "EUR",
          priceBreaks: entry.breaks,
          stock: entry.stock ?? null,
          factoryLeadDays: null,
          lifecycle: entry.lifecycle ?? null,
          productUrl: null,
          fetchedAt: now,
        });
      }
      return out;
    },
  };
}
