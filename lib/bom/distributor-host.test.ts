import { describe, expect, it } from "vitest";

import {
  distributorFromHost,
  manufacturerFromDigiKeyPath,
  parseProductLink,
} from "./distributor-host";

describe("distributorFromHost", () => {
  it("maps Digi-Key DE as approved EU", () => {
    expect(distributorFromHost("www.digikey.de")).toMatchObject({
      hostKey: "digikey.de",
      name: "Digi-Key",
      approved: true,
      country: "DE",
    });
  });

  it("maps LCSC as unapproved China", () => {
    expect(distributorFromHost("lcsc.com")).toMatchObject({
      hostKey: "lcsc.com",
      name: "LCSC",
      approved: false,
      country: "CN",
    });
  });

  it("returns null for unknown hosts", () => {
    expect(distributorFromHost("example.com")).toBeNull();
  });
});

describe("parseProductLink", () => {
  it("extracts Digi-Key manufacturer slug without scraping", () => {
    const parsed = parseProductLink(
      "https://www.digikey.de/de/products/detail/bourns-inc/CR0402-FX-6040GLF/3783441",
    );
    expect(parsed.distributor?.name).toBe("Digi-Key");
    expect(parsed.manufacturerSlug).toBe("Bourns Inc");
  });

  it("maps LCSC product links", () => {
    const parsed = parseProductLink("https://www.lcsc.com/product-detail/C82351.html");
    expect(parsed.distributor?.name).toBe("LCSC");
    expect(parsed.distributor?.approved).toBe(false);
  });
});

describe("manufacturerFromDigiKeyPath", () => {
  it("title-cases the slug after detail", () => {
    expect(
      manufacturerFromDigiKeyPath(
        "/de/products/detail/stmicroelectronics/M24128-BFMH6TG/7348330",
      ),
    ).toBe("Stmicroelectronics");
  });
});
