import { describe, expect, it } from "vitest";

import { parseEcbDailyXml, toEuroCents } from "./ecb";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-11-25'>
      <Cube currency='USD' rate='1.1000'/>
      <Cube currency='GBP' rate='0.8800'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe("parseEcbDailyXml", () => {
  it("reads the date and currency cubes", () => {
    const rates = parseEcbDailyXml(SAMPLE);
    expect(rates.date).toBe("2026-11-25");
    expect(rates.rates.EUR).toBe(1);
    expect(rates.rates.USD).toBe(1.1);
    expect(rates.rates.GBP).toBe(0.88);
  });
});

describe("toEuroCents", () => {
  it("converts foreign amounts using units-per-EUR rates", () => {
    expect(toEuroCents(11, "USD", { EUR: 1, USD: 1.1 })).toBe(1000);
    expect(toEuroCents(12.5, "EUR", { EUR: 1 })).toBe(1250);
    expect(toEuroCents(1, "JPY", { EUR: 1, USD: 1.1 })).toBeNull();
  });
});
