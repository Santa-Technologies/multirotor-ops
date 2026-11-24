/**
 * Pricing engine types. Money is euro cents; intermediate values may carry
 * fractions of a cent and are rounded only where the spec rounds. Percentages
 * are whole-number percent (30 means 30%).
 */

/** Per-product settings, mirroring the quote_settings row. */
export type PricingSettings = {
  /** Manual unit cost estimate at the 100-unit tier. */
  manualCostCents: number;
  /** Board quantity → factor on the manual cost estimate. */
  costFactors: Record<string, number>;
  marginPct: number;
  /** Margins below this need admin approval. */
  minMarginPct: number;
  floorCents: number;
  stdDepositPct: number;
  surcharges: {
    /** r_d: surcharge % per 10 points of deposit below the standard deposit. */
    depositRatePct: number;
    /** r_t: surcharge % per 30 days of payment terms after shipment. */
    paymentTermsRatePct: number;
  };
  /** Monthly cost of capital, applied to negative cash positions. */
  costOfCapitalPct: number;
  /** Possible savings: low cost = cost × (1 − savings). */
  savingsPct: number;
  /** Cost risk: high cost = cost × (1 + risk). */
  costRiskPct: number;
  leadWeeks: number;
  monthlyCapacity: number;
  validityDays: number;
  approvalMinDepositPct: number;
  approvalMaxPaymentDays: number;
};

export type CostRunLineFlag = {
  mpn: string;
  flag: "long_lead" | "low_stock";
  /** Smallest board quantity the flag applies to; omitted means every quantity. */
  minBoards?: number;
};

/** The parts of the latest cost run the engine needs. */
export type CostRunInput = {
  runAt: Date;
  coveragePct: number;
  /** Board quantity → total cost per board (material + assembly). */
  tiers: Record<string, { totalCents: number }>;
  lineFlags: CostRunLineFlag[];
};

export type QuoteInput = {
  quantity: number;
  depositPct: number;
  /** Payment days after shipment for the balance. */
  paymentDays: number;
  /** Overrides settings.marginPct for this quote. */
  marginPct?: number;
  /** Latest cost run; omit to price from the manual estimate. */
  costRun?: CostRunInput;
  /** "Now" for the cost-run age check; passed in to keep the engine pure. */
  asOf: Date;
};

export type CostSource =
  | { kind: "computed"; runAt: Date; coveragePct: number }
  | { kind: "estimated"; reason: "no_cost_run" | "low_coverage" };

export type PriceCase = {
  unitCostCents: number;
  priceBeforeTermsCents: number;
  floorApplied: boolean;
  /** Final unit price: after surcharge, rounded up to the next €0.50. */
  unitPriceCents: number;
  totalCents: number;
};

export type DeliveryBatch = { index: number; month: number; quantity: number };

export type DeliveryPlan = {
  batches: DeliveryBatch[];
  firstDeliveryMonth: number;
};

export type CashFlowMonth = {
  month: number;
  inflowCents: number;
  outflowCents: number;
  cumulativeCents: number;
};

export type CashFlow = {
  months: CashFlowMonth[];
  /** Largest negative cumulative position, as a positive number; 0 when never negative. */
  peakPreFinancingCents: number;
  /** Month of the peak, or null when no pre-financing is needed. */
  peakMonth: number | null;
  /** First month with a negative cumulative position, or null. */
  preFinancingStartMonth: number | null;
  financingCostCents: number;
};

export type Warning =
  | { code: "pre_financing_needed"; peakCents: number; month: number }
  | {
      code: "deposit_below_first_batch_cost";
      depositCents: number;
      firstBatchCostCents: number;
    }
  | { code: "floor_sets_price" }
  | { code: "cost_estimated" }
  | { code: "cost_run_stale"; ageDays: number }
  | { code: "line_flag"; mpn: string; flag: CostRunLineFlag["flag"] };

export type ApprovalReason =
  | "price_at_floor"
  | "margin_below_minimum"
  | "deposit_below_minimum"
  | "payment_terms_too_long";

export type QuoteResult = {
  quantity: number;
  depositPct: number;
  paymentDays: number;
  marginPct: number;
  costSource: CostSource;
  /** Unit cost before the cost range is applied. */
  unitCostCents: number;
  surchargePct: number;
  /** Low price, low cost. */
  low: PriceCase;
  /** High price, high cost. */
  high: PriceCase;
  deposit: { lowCents: number; highCents: number };
  delivery: DeliveryPlan;
  /** Conservative case: low price, high cost. */
  cashFlow: CashFlow;
  warnings: Warning[];
  approval: { required: boolean; reasons: ApprovalReason[] };
  validityDays: number;
};
