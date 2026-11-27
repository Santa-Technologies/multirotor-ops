import { describe, expect, it } from "vitest";

import { PILOT_H743_SETTINGS } from "./defaults";
import { calculateQuote } from "./quote";
import { quoteText } from "./quote-text";

const asOf = new Date("2026-11-24T12:00:00Z");
const text = (quantity: number, depositPct = 50, paymentDays = 0) =>
  quoteText(
    calculateQuote({ quantity, depositPct, paymentDays, asOf }, PILOT_H743_SETTINGS),
    "Pilot H743",
  );

describe("quoteText (provisional wording)", () => {
  it("renders the reference quote in English number format", () => {
    expect(text(20_000)).toBe(
      [
        "Indicative quote: Pilot H743, 20,000 units",
        "",
        "Unit price: €82.00 – €99.00 per unit, excl. VAT",
        "Total: €1,640,000.00 – €1,980,000.00",
        "Payment: 50% deposit on order (€820,000.00 – €990,000.00), balance on delivery.",
        "Delivery: 8 monthly batches of up to 2,500 units, first delivery in month 3 after order.",
        "",
        "This indicative quote is valid for 30 days. The final price depends on component prices at the time of order.",
      ].join("\n"),
    );
  });

  it("mentions the surcharge and payment days", () => {
    const result = text(20_000, 20, 30);
    expect(result).toContain("includes a 4% surcharge for the payment terms");
    expect(result).toContain("20% deposit on order");
    expect(result).toContain("balance 30 days after shipment");
  });

  it("handles no deposit and a single batch", () => {
    const result = text(50, 0);
    expect(result).toContain("Payment: no deposit, full amount on delivery.");
    expect(result).toContain("Delivery: one batch in month 3 after order.");
  });

  it("uses customer-facing wording when requested", () => {
    const result = quoteText(
      calculateQuote(
        { quantity: 20_000, depositPct: 50, paymentDays: 0, asOf },
        PILOT_H743_SETTINGS,
      ),
      "Pilot H743",
      {
        customerFacing: true,
        quoteNumber: "MR-2026-0001",
        companyName: "Acme GmbH",
        validUntil: "2026-12-24",
      },
    );
    expect(result).toContain("Quote number: MR-2026-0001");
    expect(result).toContain("Customer: Acme GmbH");
    expect(result).toContain("Quote: Pilot H743, 20,000 units");
    expect(result).not.toContain("Indicative quote");
    expect(result).toContain("This quote is valid until 24.12.2026");
  });
});
