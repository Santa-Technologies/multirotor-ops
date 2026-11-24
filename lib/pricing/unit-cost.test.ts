import { describe, expect, it } from "vitest";

import { PILOT_H743_SETTINGS } from "./defaults";
import type { CostRunInput } from "./types";
import { unitCostAt } from "./unit-cost";

const run = (coveragePct: number): CostRunInput => ({
  runAt: new Date("2026-11-23T05:00:00Z"),
  coveragePct,
  tiers: { "100": { totalCents: 9000 }, "1000": { totalCents: 7000 } },
  lineFlags: [],
});

describe("unitCostAt", () => {
  it("uses the manual estimate times the factor curve without a cost run", () => {
    const result = unitCostAt(1000, PILOT_H743_SETTINGS);
    expect(result.unitCostCents).toBeCloseTo(8600 * 0.85, 10);
    expect(result.source).toEqual({ kind: "estimated", reason: "no_cost_run" });
  });

  it("interpolates the cost run when coverage is at least 90%", () => {
    const result = unitCostAt(Math.sqrt(100 * 1000), PILOT_H743_SETTINGS, run(90));
    expect(result.unitCostCents).toBeCloseTo(8000, 8);
    expect(result.source).toMatchObject({ kind: "computed", coveragePct: 90 });
  });

  it("falls back to the manual estimate below 90% coverage", () => {
    const result = unitCostAt(1000, PILOT_H743_SETTINGS, run(89.99));
    expect(result.unitCostCents).toBeCloseTo(8600 * 0.85, 10);
    expect(result.source).toEqual({ kind: "estimated", reason: "low_coverage" });
  });
});
