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

  it("maps G5S-style Designation and Link columns", () => {
    expect(
      suggestBomMapping([
        "Id",
        "Designator",
        "Footprint",
        "Qty",
        "Designation",
        "Link",
        "MPN",
      ]),
    ).toMatchObject({
      mpn: "MPN",
      qtyPerBoard: "Qty",
      designators: "Designator",
      description: "Designation",
      productUrl: "Link",
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
        productUrl: null,
        distributorHostKey: null,
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

  it("parses Link host into distributorHostKey and Digi-Key manufacturer", () => {
    const csv = [
      "MPN,Qty,Designation,Link",
      "AT7456E,1,OSD,https://www.lcsc.com/product-detail/C82351.html",
      "CR0402-FX-6040GLF,4,600,https://www.digikey.de/de/products/detail/bourns-inc/CR0402-FX-6040GLF/3783441",
    ].join("\n");
    const mapping = suggestBomMapping(["MPN", "Qty", "Designation", "Link"]);
    const result = parseBomCsv(csv, mapping);
    expect(result.rows[0]).toMatchObject({
      mpn: "AT7456E",
      description: "OSD",
      distributorHostKey: "lcsc.com",
    });
    expect(result.rows[1]).toMatchObject({
      mpn: "CR0402-FX-6040GLF",
      manufacturer: "Bourns Inc",
      distributorHostKey: "digikey.de",
    });
  });
});
