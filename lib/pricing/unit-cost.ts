import { MIN_COVERAGE_PCT } from "./defaults";
import { interpolateLogLinear } from "./interpolate";
import type { CostRunInput, CostSource, PricingSettings } from "./types";

/**
 * Unit cost at a quantity: interpolated from the cost run when its BOM
 * coverage is at least 90%, otherwise the manual estimate times the cost
 * factor curve (marked "estimated").
 */
export function unitCostAt(
  quantity: number,
  settings: PricingSettings,
  costRun?: CostRunInput,
): { unitCostCents: number; source: CostSource } {
  if (
    costRun &&
    costRun.coveragePct >= MIN_COVERAGE_PCT &&
    Object.keys(costRun.tiers).length > 0
  ) {
    const totals = Object.fromEntries(
      Object.entries(costRun.tiers).map(([qty, tier]) => [qty, tier.totalCents]),
    );
    return {
      unitCostCents: interpolateLogLinear(totals, quantity),
      source: {
        kind: "computed",
        runAt: costRun.runAt,
        coveragePct: costRun.coveragePct,
      },
    };
  }

  return {
    unitCostCents:
      settings.manualCostCents * interpolateLogLinear(settings.costFactors, quantity),
    source: { kind: "estimated", reason: costRun ? "low_coverage" : "no_cost_run" },
  };
}
