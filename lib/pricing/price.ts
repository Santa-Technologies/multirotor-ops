/** Final unit prices are rounded up to this step (€0.50). */
export const PRICE_STEP_CENTS = 50;

/** low = cost × (1 − savings %), high = cost × (1 + cost risk %). */
export function costRange(
  unitCostCents: number,
  savingsPct: number,
  costRiskPct: number,
) {
  return {
    lowCents: unitCostCents * (1 - savingsPct / 100),
    highCents: unitCostCents * (1 + costRiskPct / 100),
  };
}

/** max(cost ÷ (1 − margin), floor), and whether the floor won. */
export function priceBeforeTerms(
  unitCostCents: number,
  marginPct: number,
  floorCents: number,
) {
  if (marginPct >= 100) throw new RangeError("Margin must be below 100%.");
  const fromMargin = unitCostCents / (1 - marginPct / 100);
  return fromMargin >= floorCents
    ? { priceCents: fromMargin, floorApplied: false }
    : { priceCents: floorCents, floorApplied: true };
}

/**
 * Terms surcharge in percent: s = max(0, (d_std − d) / 10) × r_d + (t / 30) × r_t,
 * with d and d_std in percent, t in days and r_d, r_t in percent.
 */
export function termsSurchargePct(
  depositPct: number,
  stdDepositPct: number,
  paymentDays: number,
  rates: { depositRatePct: number; paymentTermsRatePct: number },
): number {
  return (
    Math.max(0, (stdDepositPct - depositPct) / 10) * rates.depositRatePct +
    (paymentDays / 30) * rates.paymentTermsRatePct
  );
}

/**
 * Rounds up to the next multiple of `step` cents. Values are first rounded to
 * a millionth of a cent so float noise (8200.0000001) does not add a step.
 */
export function roundUpToStep(cents: number, step = PRICE_STEP_CENTS): number {
  const clean = Math.round(cents * 1e6) / 1e6;
  return Math.ceil(clean / step) * step;
}

/** Final unit price: price × (1 + s), rounded up to the next €0.50. */
export function finalUnitPrice(
  priceBeforeTermsCents: number,
  surchargePct: number,
): number {
  return roundUpToStep(priceBeforeTermsCents * (1 + surchargePct / 100));
}
