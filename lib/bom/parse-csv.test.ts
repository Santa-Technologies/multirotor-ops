import { describe, expect, it } from "vitest";

import { parseBomCsv, suggestBomMapping } from "./parse-csv";

describe("suggestBomMapping", () => {
  it("maps common header aliases", () => {
    expect(
      suggestBomMapping(["MPN", "Manufacturer", "Qty", "Designators", "Description"]),
    ).toEqual({
      mpn: "MPN",
      manufacturer: "Manufacturer",
      qtyPerBoard: "Qty",
      designators: "Designators",
      description: "Description",
    });
  });
});

describe("parseBomCsv", () => {
  it("parses rows and reports bad quantities", () => {
    const csv = [
      "MPN,Manufacturer,Qty,Designators",
      "STM32H743VIT6,ST,1,U1",
      "BMI088,Bosch,0,U2",
      ",ST,1,U3",
    ].join("\n");

    const result = parseBomCsv(csv, {
      mpn: "MPN",
      manufacturer: "Manufacturer",
      qtyPerBoard: "Qty",
      designators: "Designators",
    });

    expect(result.rows).toEqual([
      {
        mpn: "STM32H743VIT6",
        manufacturer: "ST",
        description: null,
        qtyPerBoard: 1,
        designators: "U1",
        sourcing: "distributor",
        alternates: [],
      },
    ]);
    expect(result.issues.map((i) => i.message)).toEqual([
      'Quantity must be a positive integer (got "0").',
      "Missing MPN.",
    ]);
  });

  it("parses alternates and direct_quote sourcing", () => {
    const csv = ["mpn,qty,sourcing,alternates", "ABC,2,direct_quote,DEF|GHI"].join("\n");
    const result = parseBomCsv(csv, suggestBomMapping(["mpn", "qty", "sourcing", "alternates"]));
    expect(result.rows[0]).toMatchObject({
      mpn: "ABC",
      qtyPerBoard: 2,
      sourcing: "direct_quote",
      alternates: ["DEF", "GHI"],
    });
  });
});
