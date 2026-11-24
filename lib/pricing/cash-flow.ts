import type { CashFlow, DeliveryPlan } from "./types";

type CashFlowInput = {
  plan: DeliveryPlan;
  quantity: number;
  /** Low-case final unit price. */
  unitPriceCents: number;
  /** High-case unit cost (parts and assembly). */
  unitCostCents: number;
  depositPct: number;
  paymentDays: number;
  costOfCapitalPct: number;
};

/**
 * Conservative cash flow (low price, high cost). Month 0: + deposit on the
 * total value. Each batch: − its parts and assembly cost one month before
 * delivery; + its share of the remaining balance in delivery month +
 * ceil(payment days ÷ 30). Returns the cumulative position per month, the
 * peak pre-financing and its month, and financing cost = sum of negative
 * balances × monthly cost of capital.
 */
export function cashFlow(input: CashFlowInput): CashFlow {
  const { plan, quantity, unitPriceCents, unitCostCents, depositPct, paymentDays } =
    input;
  const totalCents = unitPriceCents * quantity;
  const depositCents = Math.round((totalCents * depositPct) / 100);
  const balanceCents = totalCents - depositCents;
  const paymentDelayMonths = Math.ceil(paymentDays / 30);

  const inflow = new Map<number, number>([[0, depositCents]]);
  const outflow = new Map<number, number>();
  const add = (map: Map<number, number>, month: number, cents: number) =>
    map.set(month, (map.get(month) ?? 0) + cents);

  let balanceAssigned = 0;
  plan.batches.forEach((batch, i) => {
    // The last batch takes the rounding remainder so the balance adds up exactly.
    const share =
      i === plan.batches.length - 1
        ? balanceCents - balanceAssigned
        : Math.round((balanceCents * batch.quantity) / quantity);
    balanceAssigned += share;
    add(inflow, batch.month + paymentDelayMonths, share);
    // Lead time under one month would put the cost before the order; book it in month 0.
    add(
      outflow,
      Math.max(0, batch.month - 1),
      Math.round(unitCostCents * batch.quantity),
    );
  });

  const lastMonth = Math.max(...inflow.keys(), ...outflow.keys());
  const months: CashFlow["months"] = [];
  let cumulative = 0;
  let peakPreFinancingCents = 0;
  let peakMonth: number | null = null;
  let preFinancingStartMonth: number | null = null;
  let negativeSum = 0;

  for (let month = 0; month <= lastMonth; month++) {
    const inflowCents = inflow.get(month) ?? 0;
    const outflowCents = outflow.get(month) ?? 0;
    cumulative += inflowCents - outflowCents;
    months.push({ month, inflowCents, outflowCents, cumulativeCents: cumulative });

    if (cumulative < 0) {
      negativeSum += -cumulative;
      preFinancingStartMonth ??= month;
      if (-cumulative > peakPreFinancingCents) {
        peakPreFinancingCents = -cumulative;
        peakMonth = month;
      }
    }
  }

  return {
    months,
    peakPreFinancingCents,
    peakMonth,
    preFinancingStartMonth,
    financingCostCents: Math.round((negativeSum * input.costOfCapitalPct) / 100),
  };
}
