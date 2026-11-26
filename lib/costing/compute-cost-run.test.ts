import { describe, expect, it } from "vitest";

import { computeCostRun } from "./compute-cost-run";

describe("computeCostRun", () => {
  it("prices material from fitting manual quotes and spreads setup", () => {
    const result = computeCostRun({
      lines: [
        { mpn: "STM32H743VIT6", qtyPerBoard: 1 },
        { mpn: "BMI088", qtyPerBoard: 2 },
      ],
      manualQuotes: [
        { mpn: "STM32H743VIT6", qty: 100, unitPriceCents: 1000, validUntil: null },
        { mpn: "STM32H743VIT6", qty: 1000, unitPriceCents: 800, validUntil: null },
        { mpn: "BMI088", qty: 1, unitPriceCents: 200, validUntil: null },
      ],
      assemblyPrices: [
        {
          qtyTier: 100,
          unitPriceCents: 500,
          setupCostCents: 10_000,
          validUntil: null,
        },
      ],
      boardTiers: [100, 1000],
      asOfDate: "2026-11-26",
    });

    expect(result.coveragePct).toBe(100);
    expect(result.tiers["100"]).toEqual({
      materialCents: 1400,
      assemblyCents: 600,
      totalCents: 2000,
    });
    expect(result.tiers["1000"]).toEqual({
      materialCents: 1200,
      assemblyCents: 510,
      totalCents: 1710,
    });
  });

  it("flags missing parts and lowers coverage", () => {
    const result = computeCostRun({
      lines: [
        { mpn: "A", qtyPerBoard: 1 },
        { mpn: "B", qtyPerBoard: 1 },
      ],
      manualQuotes: [{ mpn: "A", qty: 1, unitPriceCents: 100, validUntil: null }],
      assemblyPrices: [],
      boardTiers: [100],
      asOfDate: "2026-11-26",
    });

    expect(result.coveragePct).toBe(50);
    expect(result.flags).toContainEqual({ code: "missing", mpn: "B" });
    expect(result.flags).toContainEqual({ code: "assembly_missing" });
    expect(result.tiers["100"]!.materialCents).toBe(100);
  });

  it("flags expired manual quotes as stale but still uses them", () => {
    const result = computeCostRun({
      lines: [{ mpn: "X", qtyPerBoard: 1 }],
      manualQuotes: [
        { mpn: "X", qty: 1, unitPriceCents: 50, validUntil: "2026-01-01" },
      ],
      assemblyPrices: [],
      boardTiers: [100],
      asOfDate: "2026-11-26",
    });

    expect(result.flags.some((f) => f.code === "stale" && f.mpn === "X")).toBe(true);
    expect(result.tiers["100"]!.materialCents).toBe(50);
  });

  it("prefers the cheaper API offer and flags low stock and EOL", () => {
    const result = computeCostRun({
      lines: [{ mpn: "IMU", qtyPerBoard: 1 }],
      manualQuotes: [
        {
          mpn: "IMU",
          qty: 100,
          unitPriceCents: 500,
          validUntil: null,
          source: "manual",
        },
        {
          mpn: "IMU",
          qty: 100,
          unitPriceCents: 400,
          validUntil: null,
          stock: 50,
          lifecycle: "NRND",
          source: "api",
        },
      ],
      assemblyPrices: [],
      boardTiers: [100],
      asOfDate: "2026-11-26",
    });

    expect(result.tiers["100"]!.materialCents).toBe(400);
    expect(result.flags.some((f) => f.code === "low_stock")).toBe(true);
    expect(result.flags.some((f) => f.code === "eol")).toBe(true);
  });
});
