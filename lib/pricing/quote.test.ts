import { describe, expect, it } from "vitest";

import { PILOT_H743_SETTINGS } from "./defaults";
import { calculateQuote } from "./quote";
import type { QuoteInput } from "./types";

const asOf = new Date("2026-11-24T12:00:00Z");
const input = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  quantity: 20_000,
  depositPct: 50,
  paymentDays: 0,
  asOf,
  ...overrides,
});

describe("calculateQuote", () => {
  it("returns totals, deposit and the conservative cash flow for the reference quote", () => {
    const result = calculateQuote(input(), PILOT_H743_SETTINGS);
    expect(result.low.totalCents).toBe(8200 * 20_000);
    expect(result.high.totalCents).toBe(9900 * 20_000);
    expect(result.deposit).toEqual({ lowCents: 82_000_000, highCents: 99_000_000 });
    expect(result.delivery.batches).toHaveLength(8);
    // Lowest point: deposit €820k − 8 × €173,075 cost + 7 × €102,500 balance = €152,900 (month 9).
    const lowest = Math.min(...result.cashFlow.months.map((m) => m.cumulativeCents));
    expect(lowest).toBe(15_290_000);
    expect(result.cashFlow.months.at(-1)).toMatchObject({
      month: 10,
      cumulativeCents: 25_540_000,
    });
    expect(result.costSource).toEqual({ kind: "estimated", reason: "no_cost_run" });
    expect(result.warnings).toEqual([{ code: "cost_estimated" }]);
    expect(result.approval).toEqual({ required: false, reasons: [] });
    expect(result.validityDays).toBe(30);
  });

  it("prices pre-financing at 1% per month without a deposit", () => {
    const result = calculateQuote(input({ depositPct: 0 }), PILOT_H743_SETTINGS);
    // 5% surcharge: €81.70 × 1.05 = €85.785 → €86.00.
    expect(result.low.unitPriceCents).toBe(8600);
    const negatives = result.cashFlow.months.reduce(
      (sum, m) => sum + Math.max(0, -m.cumulativeCents),
      0,
    );
    expect(result.cashFlow.financingCostCents).toBe(Math.round(negatives / 100));
    expect(result.approval.reasons).toEqual(["deposit_below_minimum"]);
  });

  it("uses a margin override and requires approval below 25%", () => {
    const result = calculateQuote(input({ marginPct: 20 }), PILOT_H743_SETTINGS);
    expect(result.marginPct).toBe(20);
    // €98.90 at 30% becomes €69.23 ÷ 0.8 = €86.54 → €87.00; low side hits the €80 floor.
    expect(result.high.unitPriceCents).toBe(8700);
    expect(result.low.floorApplied).toBe(true);
    expect(result.approval.reasons).toEqual(["price_at_floor", "margin_below_minimum"]);
    expect(result.warnings.map((w) => w.code)).toContain("floor_sets_price");
  });

  it("uses computed cost from a recent cost run with 90% coverage", () => {
    const costRun = {
      runAt: new Date("2026-11-23T05:00:00Z"),
      coveragePct: 92,
      tiers: { "10000": { totalCents: 7000 }, "20000": { totalCents: 6000 } },
      lineFlags: [{ mpn: "STM32H743VIT6", flag: "long_lead" as const }],
    };
    const result = calculateQuote(input({ costRun }), PILOT_H743_SETTINGS);
    expect(result.unitCostCents).toBe(6000);
    expect(result.costSource).toMatchObject({ kind: "computed", coveragePct: 92 });
    expect(result.warnings).toEqual([
      { code: "line_flag", mpn: "STM32H743VIT6", flag: "long_lead" },
    ]);
  });

  it("does not depend on the settings object being mutated", () => {
    const settings = structuredClone(PILOT_H743_SETTINGS);
    calculateQuote(input(), settings);
    expect(settings).toEqual(PILOT_H743_SETTINGS);
  });

  it("rejects invalid input", () => {
    expect(() => calculateQuote(input({ quantity: 0 }), PILOT_H743_SETTINGS)).toThrow(
      RangeError,
    );
    expect(() => calculateQuote(input({ quantity: 1.5 }), PILOT_H743_SETTINGS)).toThrow(
      RangeError,
    );
    expect(() => calculateQuote(input({ depositPct: 101 }), PILOT_H743_SETTINGS)).toThrow(
      RangeError,
    );
    expect(() => calculateQuote(input({ paymentDays: -1 }), PILOT_H743_SETTINGS)).toThrow(
      RangeError,
    );
    expect(() => calculateQuote(input({ marginPct: 100 }), PILOT_H743_SETTINGS)).toThrow(
      RangeError,
    );
  });
});
