import { MAX_COST_RUN_AGE_DAYS } from "./defaults";
import type {
  ApprovalReason,
  CashFlow,
  CostRunInput,
  CostSource,
  PricingSettings,
  Warning,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

type WarningInput = {
  quantity: number;
  cashFlow: CashFlow;
  depositCents: number;
  firstBatchCostCents: number;
  floorApplied: boolean;
  costSource: CostSource;
  costRun?: CostRunInput;
  asOf: Date;
};

/** Collects the engine warnings listed in the spec, in a stable order. */
export function collectWarnings(input: WarningInput): Warning[] {
  const warnings: Warning[] = [];
  const { cashFlow } = input;

  if (cashFlow.peakPreFinancingCents > 0 && cashFlow.peakMonth !== null) {
    warnings.push({
      code: "pre_financing_needed",
      peakCents: cashFlow.peakPreFinancingCents,
      month: cashFlow.peakMonth,
    });
  }
  if (input.depositCents < input.firstBatchCostCents) {
    warnings.push({
      code: "deposit_below_first_batch_cost",
      depositCents: input.depositCents,
      firstBatchCostCents: input.firstBatchCostCents,
    });
  }
  if (input.floorApplied) warnings.push({ code: "floor_sets_price" });
  if (input.costSource.kind === "estimated") warnings.push({ code: "cost_estimated" });

  if (input.costRun) {
    const ageDays = Math.floor(
      (input.asOf.getTime() - input.costRun.runAt.getTime()) / DAY_MS,
    );
    if (ageDays > MAX_COST_RUN_AGE_DAYS)
      warnings.push({ code: "cost_run_stale", ageDays });

    for (const line of input.costRun.lineFlags) {
      if (line.minBoards === undefined || input.quantity >= line.minBoards) {
        warnings.push({ code: "line_flag", mpn: line.mpn, flag: line.flag });
      }
    }
  }
  return warnings;
}

type ApprovalInput = {
  floorApplied: boolean;
  marginPct: number;
  depositPct: number;
  paymentDays: number;
  settings: PricingSettings;
};

/**
 * Admin approval is needed before sending when the price hits the floor, the
 * margin is below the product's minimum, the deposit is below the minimum, or
 * payment terms exceed the maximum.
 */
export function approvalRequirement(input: ApprovalInput) {
  const { settings } = input;
  const reasons: ApprovalReason[] = [];
  if (input.floorApplied) reasons.push("price_at_floor");
  if (input.marginPct < settings.minMarginPct) reasons.push("margin_below_minimum");
  if (input.depositPct < settings.approvalMinDepositPct)
    reasons.push("deposit_below_minimum");
  if (input.paymentDays > settings.approvalMaxPaymentDays)
    reasons.push("payment_terms_too_long");
  return { required: reasons.length > 0, reasons };
}
