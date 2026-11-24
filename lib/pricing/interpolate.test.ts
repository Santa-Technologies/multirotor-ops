import { describe, expect, it } from "vitest";

import { PILOT_H743_SETTINGS } from "./defaults";
import { interpolateLogLinear } from "./interpolate";

const factors = PILOT_H743_SETTINGS.costFactors;

describe("interpolateLogLinear", () => {
  it("returns the tier value at each tier", () => {
    expect(interpolateLogLinear(factors, 100)).toBe(1);
    expect(interpolateLogLinear(factors, 1000)).toBe(0.85);
    expect(interpolateLogLinear(factors, 5000)).toBe(0.78);
    expect(interpolateLogLinear(factors, 10000)).toBe(0.75);
    expect(interpolateLogLinear(factors, 20000)).toBe(0.7);
  });

  it("interpolates on ln(q) between the two nearest tiers", () => {
    // ln 316.23 is halfway between ln 100 and ln 1000.
    expect(interpolateLogLinear(factors, Math.sqrt(100 * 1000))).toBeCloseTo(0.925, 10);
    // f(2000) = 0.85 + (ln 2000 − ln 1000) / (ln 5000 − ln 1000) × (0.78 − 0.85).
    const expected = 0.85 + (Math.log(2) / Math.log(5)) * -0.07;
    expect(interpolateLogLinear(factors, 2000)).toBeCloseTo(expected, 12);
  });

  it("uses the nearest tier outside the range", () => {
    expect(interpolateLogLinear(factors, 1)).toBe(1);
    expect(interpolateLogLinear(factors, 50)).toBe(1);
    expect(interpolateLogLinear(factors, 50_000)).toBe(0.7);
  });

  it("does not depend on key order", () => {
    expect(interpolateLogLinear({ "1000": 2, "100": 4 }, 316)).toBeCloseTo(
      interpolateLogLinear({ "100": 4, "1000": 2 }, 316),
      12,
    );
  });

  it("rejects an empty curve", () => {
    expect(() => interpolateLogLinear({}, 100)).toThrow(RangeError);
  });
});
