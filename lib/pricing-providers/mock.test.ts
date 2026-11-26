import { describe, expect, it } from "vitest";

import { createMockPriceProvider } from "./mock";

describe("createMockPriceProvider", () => {
  it("returns EUR offers for configured MPNs and skips unknowns", async () => {
    const provider = createMockPriceProvider({
      BMI088: {
        distributorName: "Mouser",
        country: "US",
        breaks: [
          { qty: 1, unitPrice: 2.5 },
          { qty: 100, unitPrice: 1.8 },
        ],
        stock: 500,
        lifecycle: "Active",
      },
    });

    const results = await provider.fetch(["BMI088", "UNKNOWN"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      mpn: "BMI088",
      distributorName: "Mouser",
      currency: "EUR",
      stock: 500,
      lifecycle: "Active",
    });
    expect(results[0]!.priceBreaks).toEqual([
      { qty: 1, unitPrice: 2.5 },
      { qty: 100, unitPrice: 1.8 },
    ]);
  });
});
