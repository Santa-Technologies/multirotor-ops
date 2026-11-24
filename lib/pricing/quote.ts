import { cashFlow } from "./cash-flow";
import { deliveryPlan } from "./delivery";
import { costRange, finalUnitPrice, priceBeforeTerms, termsSurchargePct } from "./price";
import type { PriceCase, PricingSettings, QuoteInput, QuoteResult } from "./types";
import { unitCostAt } from "./unit-cost";
import { approvalRequirement, collectWarnings } from "./warnings";

/** Rejects inputs the formulas are not defined for. */
function validate(input: QuoteInput, marginPct: number, settings: PricingSettings) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new RangeError("Quantity must be a whole number of at least 1.");
  }
  if (input.depositPct < 0 || input.depositPct > 100) {
    throw new RangeError("Deposit must be between 0% and 100%.");
  }
  if (input.paymentDays < 0) throw new RangeError("Payment days cannot be negative.");
  if (marginPct < 0 || marginPct >= 100)
    throw new RangeError("Margin must be between 0% and 100%.");
  if (settings.monthlyCapacity <= 0)
    throw new RangeError("Monthly capacity must be positive.");
}

/**
 * Prices a quote: unit cost (cost run or manual estimate), cost range, price
 * before terms per case, terms surcharge and rounding, delivery plan,
 * conservative cash flow, warnings and the approval rule. Pure: no I/O, and
 * "now" comes in as input.asOf.
 */
export function calculateQuote(
  input: QuoteInput,
  settings: PricingSettings,
): QuoteResult {
  const marginPct = input.marginPct ?? settings.marginPct;
  validate(input, marginPct, settings);
  const { quantity, depositPct, paymentDays } = input;

  const { unitCostCents, source } = unitCostAt(quantity, settings, input.costRun);
  const range = costRange(unitCostCents, settings.savingsPct, settings.costRiskPct);
  const surchargePct = termsSurchargePct(
    depositPct,
    settings.stdDepositPct,
    paymentDays,
    settings.surcharges,
  );

  const priceCase = (caseCostCents: number): PriceCase => {
    const before = priceBeforeTerms(caseCostCents, marginPct, settings.floorCents);
    const unitPriceCents = finalUnitPrice(before.priceCents, surchargePct);
    return {
      unitCostCents: caseCostCents,
      priceBeforeTermsCents: before.priceCents,
      floorApplied: before.floorApplied,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
    };
  };
  const low = priceCase(range.lowCents);
  const high = priceCase(range.highCents);

  const delivery = deliveryPlan(quantity, settings.monthlyCapacity, settings.leadWeeks);
  const flow = cashFlow({
    plan: delivery,
    quantity,
    unitPriceCents: low.unitPriceCents,
    unitCostCents: high.unitCostCents,
    depositPct,
    paymentDays,
    costOfCapitalPct: settings.costOfCapitalPct,
  });

  const deposit = {
    lowCents: Math.round((low.totalCents * depositPct) / 100),
    highCents: Math.round((high.totalCents * depositPct) / 100),
  };
  const floorApplied = low.floorApplied || high.floorApplied;

  return {
    quantity,
    depositPct,
    paymentDays,
    marginPct,
    costSource: source,
    unitCostCents,
    surchargePct,
    low,
    high,
    deposit,
    delivery,
    cashFlow: flow,
    warnings: collectWarnings({
      quantity,
      cashFlow: flow,
      depositCents: deposit.lowCents,
      firstBatchCostCents: Math.round(high.unitCostCents * delivery.batches[0].quantity),
      floorApplied,
      costSource: source,
      costRun: input.costRun,
      asOf: input.asOf,
    }),
    approval: approvalRequirement({
      floorApplied,
      marginPct,
      depositPct,
      paymentDays,
      settings,
    }),
    validityDays: settings.validityDays,
  };
}
