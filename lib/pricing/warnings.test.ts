import { describe, expect, it } from "vitest";

import { PILOT_H743_SETTINGS } from "./defaults";
import type { CashFlow, CostRunInput } from "./types";
import { approvalRequirement, collectWarnings } from "./warnings";

const asOf = new Date("2026-11-24T12:00:00Z");
const noPreFinancing: CashFlow = {
  months: [],
  peakPreFinancingCents: 0,
  peakMonth: null,
  preFinancingStartMonth: null,
  financingCostCents: 0,
};
const computed = { kind: "computed", runAt: asOf, coveragePct: 95 } as const;
const base = {
  quantity: 1000,
  cashFlow: noPreFinancing,
  depositCents: 100,
  firstBatchCostCents: 50,
  floorApplied: false,
  costSource: computed,
  asOf,
};
const run = (
  daysOld: number,
  lineFlags: CostRunInput["lineFlags"] = [],
): CostRunInput => ({
  runAt: new Date(asOf.getTime() - daysOld * 24 * 60 * 60 * 1000),
  coveragePct: 95,
  tiers: {},
  lineFlags,
});
const codes = (input: Parameters<typeof collectWarnings>[0]) =>
  collectWarnings(input).map((w) => w.code);

describe("collectWarnings", () => {
  it("returns nothing for a clean quote", () => {
    expect(collectWarnings({ ...base, costRun: run(1) })).toEqual([]);
  });

  it("flags pre-financing with the peak and its month", () => {
    const cashFlow = {
      ...noPreFinancing,
      peakPreFinancingCents: 500,
      peakMonth: 2,
      preFinancingStartMonth: 2,
    };
    expect(collectWarnings({ ...base, cashFlow })).toContainEqual({
      code: "pre_financing_needed",
      peakCents: 500,
      month: 2,
    });
  });

  it("flags a deposit below the first batch cost", () => {
    expect(codes({ ...base, depositCents: 49 })).toEqual([
      "deposit_below_first_batch_cost",
    ]);
    expect(codes({ ...base, depositCents: 50 })).toEqual([]);
  });

  it("flags the floor and an estimated cost", () => {
    expect(codes({ ...base, floorApplied: true })).toEqual(["floor_sets_price"]);
    expect(
      codes({ ...base, costSource: { kind: "estimated", reason: "no_cost_run" } }),
    ).toEqual(["cost_estimated"]);
  });

  it("flags a cost run older than 7 days", () => {
    expect(codes({ ...base, costRun: run(7) })).toEqual([]);
    expect(collectWarnings({ ...base, costRun: run(8) })).toEqual([
      { code: "cost_run_stale", ageDays: 8 },
    ]);
  });

  it("lists BOM line flags that apply at this quantity, with the MPN", () => {
    const costRun = run(1, [
      { mpn: "LONG-1", flag: "long_lead" },
      { mpn: "STOCK-5K", flag: "low_stock", minBoards: 5000 },
      { mpn: "STOCK-1K", flag: "low_stock", minBoards: 1000 },
    ]);
    expect(collectWarnings({ ...base, costRun })).toEqual([
      { code: "line_flag", mpn: "LONG-1", flag: "long_lead" },
      { code: "line_flag", mpn: "STOCK-1K", flag: "low_stock" },
    ]);
  });
});

describe("approvalRequirement", () => {
  const ok = {
    floorApplied: false,
    marginPct: 30,
    depositPct: 50,
    paymentDays: 0,
    settings: PILOT_H743_SETTINGS,
  };

  it("is not required for default terms", () => {
    expect(approvalRequirement(ok)).toEqual({ required: false, reasons: [] });
  });

  it("is required at the floor", () => {
    expect(approvalRequirement({ ...ok, floorApplied: true }).reasons).toEqual([
      "price_at_floor",
    ]);
  });

  it("is required below the 25% minimum margin", () => {
    expect(approvalRequirement({ ...ok, marginPct: 25 }).required).toBe(false);
    expect(approvalRequirement({ ...ok, marginPct: 24.9 }).reasons).toEqual([
      "margin_below_minimum",
    ]);
  });

  it("is required below a 30% deposit", () => {
    expect(approvalRequirement({ ...ok, depositPct: 30 }).required).toBe(false);
    expect(approvalRequirement({ ...ok, depositPct: 29 }).reasons).toEqual([
      "deposit_below_minimum",
    ]);
  });

  it("is required above 60 payment days", () => {
    expect(approvalRequirement({ ...ok, paymentDays: 60 }).required).toBe(false);
    expect(approvalRequirement({ ...ok, paymentDays: 61 }).reasons).toEqual([
      "payment_terms_too_long",
    ]);
  });

  it("lists every reason that applies", () => {
    expect(
      approvalRequirement({
        ...ok,
        floorApplied: true,
        marginPct: 20,
        depositPct: 0,
        paymentDays: 90,
      }).reasons,
    ).toEqual([
      "price_at_floor",
      "margin_below_minimum",
      "deposit_below_minimum",
      "payment_terms_too_long",
    ]);
  });
});
