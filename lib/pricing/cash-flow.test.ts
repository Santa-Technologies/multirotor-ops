import { describe, expect, it } from "vitest";

import { cashFlow } from "./cash-flow";
import { deliveryPlan } from "./delivery";

// 5,000 units at €100 price and €60 cost, two batches shipping in months 3 and 4.
const base = {
  plan: deliveryPlan(5000, 2500, 12),
  quantity: 5000,
  unitPriceCents: 10_000,
  unitCostCents: 6000,
  paymentDays: 0,
  costOfCapitalPct: 1,
};
const cumulative = (flow: ReturnType<typeof cashFlow>) =>
  flow.months.map((m) => m.cumulativeCents);

describe("cashFlow", () => {
  it("takes the deposit in month 0, pays each batch a month early and collects the balance on delivery", () => {
    const flow = cashFlow({ ...base, depositPct: 50 });
    // Deposit €250k; batches cost €150k in months 2 and 3; €125k balance in months 3 and 4.
    expect(flow.months[0]).toEqual({
      month: 0,
      inflowCents: 25_000_000,
      outflowCents: 0,
      cumulativeCents: 25_000_000,
    });
    expect(cumulative(flow)).toEqual([
      25_000_000, 25_000_000, 10_000_000, 7_500_000, 20_000_000,
    ]);
    expect(flow.peakPreFinancingCents).toBe(0);
    expect(flow.peakMonth).toBeNull();
    expect(flow.preFinancingStartMonth).toBeNull();
    expect(flow.financingCostCents).toBe(0);
  });

  it("reports peak pre-financing, its month and financing cost without a deposit", () => {
    const flow = cashFlow({ ...base, depositPct: 0 });
    expect(cumulative(flow)).toEqual([0, 0, -15_000_000, -5_000_000, 20_000_000]);
    expect(flow.preFinancingStartMonth).toBe(2);
    expect(flow.peakPreFinancingCents).toBe(15_000_000);
    expect(flow.peakMonth).toBe(2);
    // (€150k + €50k) × 1%.
    expect(flow.financingCostCents).toBe(200_000);
  });

  it("delays the balance by ceil(payment days ÷ 30) months", () => {
    const flow = cashFlow({ ...base, depositPct: 50, paymentDays: 45 });
    const inflowMonths = flow.months.filter((m) => m.inflowCents > 0).map((m) => m.month);
    expect(inflowMonths).toEqual([0, 5, 6]);
    expect(flow.months).toHaveLength(7);
  });

  it("collects exactly the total value across uneven batches", () => {
    const flow = cashFlow({
      ...base,
      plan: deliveryPlan(3333, 1000, 12),
      quantity: 3333,
      unitPriceCents: 8450,
      depositPct: 33,
    });
    const collected = flow.months.reduce((sum, m) => sum + m.inflowCents, 0);
    expect(collected).toBe(8450 * 3333);
  });

  it("scales financing cost with the cost of capital", () => {
    expect(
      cashFlow({ ...base, depositPct: 0, costOfCapitalPct: 2 }).financingCostCents,
    ).toBe(400_000);
  });
});
