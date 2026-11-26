/** Formats euro cents for on-screen German locale (1.234,56 €). */
export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Formats a whole-number percent for screens. */
export function formatPct(pct: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(pct)} %`;
}

/** Parses a decimal euros string (comma or dot) into integer cents. */
export function parseEuroToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
