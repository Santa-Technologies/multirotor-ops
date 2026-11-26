import { describe, expect, it } from "vitest";

import { normaliseExtract } from "./parse-offer";

describe("normaliseExtract", () => {
  it("converts EUR unit prices to cents", () => {
    const draft = normaliseExtract({
      qty: 100,
      unit_price: 1.25,
      currency: "EUR",
      stock: 500,
      valid_until: "2026-12-31",
      lead_days: 14,
      notes: "MOQ 100",
    });
    expect(draft.qty).toBe(100);
    expect(draft.unitPriceCents).toBe(125);
    expect(draft.currency).toBe("EUR");
    expect(draft.validUntil).toBe("2026-12-31");
  });

  it("leaves non-EUR cents null until edge conversion", () => {
    const draft = normaliseExtract({
      qty: 10,
      unit_price: 2,
      currency: "USD",
    });
    expect(draft.unitPriceCents).toBeNull();
    expect(draft.unitPrice).toBe(2);
    expect(draft.currency).toBe("USD");
  });
});
