import { describe, expect, it } from "vitest";

import {
  costRange,
  finalUnitPrice,
  priceBeforeTerms,
  roundUpToStep,
  termsSurchargePct,
} from "./price";

const rates = { depositRatePct: 1, paymentTermsRatePct: 1 };

describe("costRange", () => {
  it("applies 5% savings and 15% risk", () => {
    const { lowCents, highCents } = costRange(6020, 5, 15);
    expect(lowCents).toBeCloseTo(5719, 8);
    expect(highCents).toBeCloseTo(6923, 8);
  });
});

describe("priceBeforeTerms", () => {
  it("divides cost by (1 − margin)", () => {
    const result = priceBeforeTerms(7000, 30, 8000);
    expect(result.priceCents).toBeCloseTo(10000, 8);
    expect(result.floorApplied).toBe(false);
  });

  it("uses the floor when it is higher", () => {
    expect(priceBeforeTerms(5000, 30, 8000)).toEqual({
      priceCents: 8000,
      floorApplied: true,
    });
  });

  it("does not report the floor when the margin price equals it", () => {
    expect(priceBeforeTerms(5600, 30, 8000).floorApplied).toBe(false);
  });

  it("rejects a margin of 100% or more", () => {
    expect(() => priceBeforeTerms(5000, 100, 0)).toThrow(RangeError);
  });
});

describe("termsSurchargePct", () => {
  it("is zero at the standard deposit and immediate payment", () => {
    expect(termsSurchargePct(50, 50, 0, rates)).toBe(0);
  });

  it("adds r_d per 10 points of deposit below standard", () => {
    expect(termsSurchargePct(20, 50, 0, rates)).toBeCloseTo(3, 10);
    expect(termsSurchargePct(0, 50, 0, rates)).toBeCloseTo(5, 10);
    expect(termsSurchargePct(45, 50, 0, rates)).toBeCloseTo(0.5, 10);
  });

  it("gives no discount for a deposit above standard", () => {
    expect(termsSurchargePct(80, 50, 0, rates)).toBe(0);
  });

  it("adds r_t per 30 payment days", () => {
    expect(termsSurchargePct(50, 50, 30, rates)).toBeCloseTo(1, 10);
    expect(termsSurchargePct(50, 50, 45, rates)).toBeCloseTo(1.5, 10);
    expect(termsSurchargePct(20, 50, 60, rates)).toBeCloseTo(5, 10);
  });
});

describe("roundUpToStep", () => {
  it("rounds up to the next €0.50", () => {
    expect(roundUpToStep(8170)).toBe(8200);
    expect(roundUpToStep(8150.01)).toBe(8200);
    expect(roundUpToStep(8101)).toBe(8150);
  });

  it("keeps exact multiples, including float noise", () => {
    expect(roundUpToStep(8200)).toBe(8200);
    expect(roundUpToStep(8200.0000001)).toBe(8200);
    expect(roundUpToStep(8199.9999999)).toBe(8200);
  });
});

describe("finalUnitPrice", () => {
  it("applies the surcharge then rounds up", () => {
    expect(finalUnitPrice(8170, 0)).toBe(8200);
    expect(finalUnitPrice(8170, 3)).toBe(8450);
    expect(finalUnitPrice(9890, 3)).toBe(10200);
  });
});
