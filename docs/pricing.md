# Pricing engine (phase 2)

`lib/pricing` turns a quantity, deposit and payment terms into an indicative quote. It is pure: no database, network or clock access (lint enforces this), and it is the only place pricing math may live. Callers load `quote_settings` and the latest cost run and pass them in, along with `asOf` ("now").

```ts
import { calculateQuote, quoteText, PILOT_H743_SETTINGS } from "@/lib/pricing";

const result = calculateQuote(
  { quantity: 20_000, depositPct: 50, paymentDays: 0, asOf: new Date() },
  PILOT_H743_SETTINGS,
);
quoteText(result, "Pilot H743");
```

Money is euro cents. Percentages are whole-number percent (30 = 30%).

## Steps

1. **Unit cost.** If a cost run with at least 90% BOM coverage is given, interpolate its per-board totals log-linearly between the two nearest tiers. Otherwise use the manual estimate × the cost factor curve (interpolated the same way) and mark the cost "estimated". Quantities below the first tier use the first tier (50 units → 100-unit factor); above the last tier, the last.
2. **Cost range.** low = cost × (1 − savings %), high = cost × (1 + cost risk %).
3. **Price before terms**, per case: max(cost ÷ (1 − margin), floor).
4. **Terms surcharge.** s = max(0, (d_std − d) / 10) × r_d + (t / 30) × r_t. A deposit above standard gives no discount.
5. **Final unit price** = price × (1 + s), rounded up to the next €0.50.
6. **Delivery plan.** batches = ceil(qty ÷ monthly capacity), all full except the last. First delivery month = ceil(lead weeks ÷ 4.345). Batch i, counted from 0, ships in month first + i.
7. **Cash flow**, conservative case (low price, high cost). Month 0: + deposit on the total value. Each batch: − its cost one month before delivery (month 0 at the earliest); + its share of the balance in delivery month + ceil(t ÷ 30). Outputs the cumulative position per month, peak pre-financing and its month, the first negative month, and financing cost = sum of negative month-end balances × monthly cost of capital.
8. **Warnings:** pre-financing needed; deposit below first-batch cost (low-case deposit vs high-case cost); floor sets the price (either case); cost estimated; cost run older than 7 days; each BOM line flagged long lead or low stock that applies at this quantity, with its MPN.
9. **Approval** is required when the price hits the floor, the margin is below the minimum, the deposit is below the minimum, or payment terms exceed the maximum.

## Pilot H743 defaults

`PILOT_H743_SETTINGS` matches the seeded `quote_settings` row (a database test checks this field by field): €86 manual cost, factors 1.00 / 0.85 / 0.78 / 0.75 / 0.70 at 100 / 1k / 5k / 10k / 20k, margin 30%, **minimum margin 25%**, floor €80, standard deposit 50%, surcharge rates 1% / 1%, **cost of capital 1% per month**, savings 5%, cost risk 15%, 12 weeks lead, 2,500 per month, 30 days validity, approval below 30% deposit or above 60 days. Minimum margin and cost of capital were decided by Justus on 24 Nov 2026.

## Interpretations

The spec does not state these; each is the reading the reference cases require or the simplest consistent one.

- Payment days default to 0 in the reference cases. With any other value, 20,000 units would not price at €82.00–€99.00.
- Batches count from 0. Otherwise "deposit 0% shows pre-financing starting in month 2" does not hold with 12 weeks lead.
- A BOM line flag applies at every quantity unless it carries `minBoards`, in which case it applies from that board quantity up. The cost run (phase 6) decides `minBoards`.
- `adj_threshold_pct` (10%) is stored but not used by the engine; the spec does not say what it adjusts.

## Quote text

`quoteText()` is **provisional**. The existing calculator's wording was not available, so the text follows the engine outputs in English number format and must be aligned with the calculator before quotes go to customers.
