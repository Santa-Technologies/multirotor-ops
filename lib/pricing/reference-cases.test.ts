import { describe, expect, it } from "vitest";

import { calculateQuote, PILOT_H743_SETTINGS } from ".";

const asOf = new Date("2026-11-24T12:00:00Z");
const quote = (quantity: number, depositPct = 50, paymentDays = 0) =>
  calculateQuote({ quantity, depositPct, paymentDays, asOf }, PILOT_H743_SETTINGS);

// The spec's reference cases at €86 reference cost (manual estimate, default settings).
describe("reference cases", () => {
  it("20,000 units gives €82.00–€99.00 per unit and no pre-financing", () => {
    const result = quote(20_000);

    // €86 × 0.70 = €60.20; × 0.95 = €57.19 and × 1.15 = €69.23; ÷ 0.7 = €81.70 and €98.90.
    expect(result.unitCostCents).toBeCloseTo(6020, 6);
    expect(result.low.unitPriceCents).toBe(8200);
    expect(result.high.unitPriceCents).toBe(9900);
    expect(result.cashFlow.peakPreFinancingCents).toBe(0);
    expect(result.cashFlow.preFinancingStartMonth).toBeNull();
    expect(result.warnings.map((w) => w.code)).not.toContain("pre_financing_needed");
  });

  it("deposit 20% adds a 3% surcharge", () => {
    const result = quote(20_000, 20);
    expect(result.surchargePct).toBeCloseTo(3, 10);
    // €81.70 × 1.03 = €84.151 → €84.50; €98.90 × 1.03 = €101.867 → €102.00.
    expect(result.low.unitPriceCents).toBe(8450);
    expect(result.high.unitPriceCents).toBe(10200);
  });

  it("deposit 0% shows pre-financing starting in month 2", () => {
    const result = quote(20_000, 0);
    expect(result.cashFlow.preFinancingStartMonth).toBe(2);
    expect(result.warnings.map((w) => w.code)).toContain("pre_financing_needed");
  });

  it("quantity 50 uses the 100-unit factor", () => {
    expect(quote(50).unitCostCents).toBe(8600);
    expect(quote(50).unitCostCents).toBe(quote(100).unitCostCents);
  });
});
