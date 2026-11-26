import type { quoteSettings } from "@/db/schema";
import type { PricingSettings } from "@/lib/pricing";

type QuoteSettingsRow = typeof quoteSettings.$inferSelect;

/**
 * Maps a quote_settings database row into the pricing engine settings shape.
 * Requires minMarginPct and costOfCapitalPct to be set (Pilot H743 seed has them).
 */
export function toPricingSettings(row: QuoteSettingsRow): PricingSettings {
  if (row.minMarginPct == null || row.costOfCapitalPct == null) {
    throw new Error(
      "quote_settings is missing min_margin_pct or cost_of_capital_pct for this product.",
    );
  }
  return {
    manualCostCents: row.manualCostCents,
    costFactors: row.costFactors,
    marginPct: Number(row.marginPct),
    minMarginPct: Number(row.minMarginPct),
    floorCents: row.floorCents,
    stdDepositPct: Number(row.stdDepositPct),
    surcharges: row.surcharges,
    costOfCapitalPct: Number(row.costOfCapitalPct),
    savingsPct: Number(row.savingsPct),
    costRiskPct: Number(row.costRiskPct),
    leadWeeks: row.leadWeeks,
    monthlyCapacity: row.monthlyCapacity,
    validityDays: row.validityDays,
    approvalMinDepositPct: Number(row.approvalMinDepositPct),
    approvalMaxPaymentDays: row.approvalMaxPaymentDays,
  };
}
