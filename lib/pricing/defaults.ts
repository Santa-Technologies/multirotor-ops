import type { PricingSettings } from "./types";

/**
 * Pilot H743 calculator defaults from the spec, plus Justus's decisions of
 * 24 Nov 2026 (minimum margin 25%, cost of capital 1% per month). The same
 * values are seeded into quote_settings by drizzle/0003 and 0004.
 */
export const PILOT_H743_SETTINGS: PricingSettings = {
  manualCostCents: 8600,
  costFactors: { "100": 1.0, "1000": 0.85, "5000": 0.78, "10000": 0.75, "20000": 0.7 },
  marginPct: 30,
  minMarginPct: 25,
  floorCents: 8000,
  stdDepositPct: 50,
  surcharges: { depositRatePct: 1, paymentTermsRatePct: 1 },
  costOfCapitalPct: 1,
  savingsPct: 5,
  costRiskPct: 15,
  leadWeeks: 12,
  monthlyCapacity: 2500,
  validityDays: 30,
  approvalMinDepositPct: 30,
  approvalMaxPaymentDays: 60,
};

/** Cost runs below this BOM coverage fall back to the manual estimate. */
export const MIN_COVERAGE_PCT = 90;

/** Cost runs older than this produce a warning. */
export const MAX_COST_RUN_AGE_DAYS = 7;

/** Weeks per month used to turn lead time into a delivery month. */
export const WEEKS_PER_MONTH = 4.345;
