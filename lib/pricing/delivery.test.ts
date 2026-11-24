import { describe, expect, it } from "vitest";

import { deliveryPlan } from "./delivery";

describe("deliveryPlan", () => {
  it("splits into ceil(qty ÷ capacity) batches starting in ceil(lead ÷ 4.345)", () => {
    const plan = deliveryPlan(20_000, 2500, 12);
    // 12 ÷ 4.345 = 2.76 → month 3.
    expect(plan.firstDeliveryMonth).toBe(3);
    expect(plan.batches).toHaveLength(8);
    expect(plan.batches[0]).toEqual({ index: 0, month: 3, quantity: 2500 });
    expect(plan.batches[7]).toEqual({ index: 7, month: 10, quantity: 2500 });
  });

  it("puts the remainder in the last batch", () => {
    const plan = deliveryPlan(6000, 2500, 12);
    expect(plan.batches.map((b) => b.quantity)).toEqual([2500, 2500, 1000]);
    expect(plan.batches.map((b) => b.month)).toEqual([3, 4, 5]);
  });

  it("ships a small order as one batch", () => {
    expect(deliveryPlan(50, 2500, 12).batches).toEqual([
      { index: 0, month: 3, quantity: 50 },
    ]);
  });

  it("rounds the lead time up to whole months", () => {
    expect(deliveryPlan(1, 1, 4.345).firstDeliveryMonth).toBe(1);
    expect(deliveryPlan(1, 1, 4.35).firstDeliveryMonth).toBe(2);
    expect(deliveryPlan(1, 1, 8.69).firstDeliveryMonth).toBe(2);
    expect(deliveryPlan(1, 1, 0).firstDeliveryMonth).toBe(0);
  });

  it("rejects a capacity of zero", () => {
    expect(() => deliveryPlan(10, 0, 12)).toThrow(RangeError);
  });
});
