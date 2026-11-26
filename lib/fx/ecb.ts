import "server-only";

const ECB_DAILY_XML =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/** Units of foreign currency per 1 EUR (ECB quotation). */
export type EcbRates = {
  date: string;
  /** currency → units per EUR (USD: 1.09 means €1 = $1.09). */
  rates: Record<string, number>;
};

/**
 * Loads the latest ECB euro foreign-exchange reference rates from the official
 * daily XML feed (no API key).
 */
export async function fetchEcbEuroRates(): Promise<EcbRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(ECB_DAILY_XML, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`ECB rates HTTP ${response.status}`);
    }
    const xml = await response.text();
    return parseEcbDailyXml(xml);
  } finally {
    clearTimeout(timer);
  }
}

/** Parses the ECB eurofxref-daily.xml cube list into a rate map. */
export function parseEcbDailyXml(xml: string): EcbRates {
  const dateMatch = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);
  if (!dateMatch) throw new Error("ECB rates: missing time attribute.");

  const rates: Record<string, number> = { EUR: 1 };
  const cubeRe =
    /currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]|rate=['"]([0-9.]+)['"]\s+currency=['"]([A-Z]{3})['"]/g;
  let match: RegExpExecArray | null;
  while ((match = cubeRe.exec(xml)) !== null) {
    const currency = match[1] ?? match[4];
    const rateRaw = match[2] ?? match[3];
    if (!currency || !rateRaw) continue;
    const rate = Number.parseFloat(rateRaw);
    if (Number.isFinite(rate) && rate > 0) rates[currency] = rate;
  }

  if (Object.keys(rates).length < 2) {
    throw new Error("ECB rates: no currency cubes found.");
  }

  return { date: dateMatch[1]!, rates };
}

/**
 * Converts an amount in `currency` to euro cents using ECB-style rates
 * (units of currency per EUR). Returns null when the currency is unknown.
 */
export function toEuroCents(
  amount: number,
  currency: string,
  rates: Record<string, number>,
): number | null {
  const code = currency.toUpperCase();
  if (code === "EUR") return Math.round(amount * 100);
  const perEur = rates[code];
  if (perEur == null || perEur <= 0) return null;
  return Math.round((amount / perEur) * 100);
}
