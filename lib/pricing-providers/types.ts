/** One quantity break from a distributor offer. */
export type PriceBreak = {
  qty: number;
  /** Unit price in the offer's currency (not yet converted). */
  unitPrice: number;
};

/**
 * Normalised distributor offer returned by a PriceProvider.
 * Currency is the source currency; conversion to EUR happens in the cost job.
 */
export type PriceResult = {
  mpn: string;
  distributorName: string;
  /** ISO country code when known (e.g. US, DE, CN). */
  country: string | null;
  currency: string;
  priceBreaks: PriceBreak[];
  stock: number | null;
  factoryLeadDays: number | null;
  lifecycle: string | null;
  productUrl: string | null;
  fetchedAt: Date;
};

export interface PriceProvider {
  name: string;
  /** Fetches offers for the given MPNs. Must not throw on a single MPN miss. */
  fetch(mpns: string[]): Promise<PriceResult[]>;
}
