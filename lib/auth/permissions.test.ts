import { describe, expect, it } from "vitest";

import { ROLES } from "./allowlist";
import { canWrite, WRITE_ACTIONS, WRITE_RULES, type WritableTable } from "./permissions";

const tables = Object.keys(WRITE_RULES) as WritableTable[];

describe("canWrite", () => {
  it("does not let sales edit a BOM", () => {
    for (const action of WRITE_ACTIONS) {
      expect(canWrite("sales", "bom_versions", action)).toBe(false);
      expect(canWrite("sales", "bom_lines", action)).toBe(false);
    }
  });

  it("lets engineering and admin edit a BOM, parts and product lines", () => {
    for (const action of WRITE_ACTIONS) {
      expect(canWrite("engineering", "bom_lines", action)).toBe(true);
      expect(canWrite("engineering", "parts", action)).toBe(true);
      expect(canWrite("engineering", "product_lines", action)).toBe(true);
      expect(canWrite("admin", "bom_lines", action)).toBe(true);
      expect(canWrite("sales", "parts", action)).toBe(false);
    }
  });

  it("matches the spec's role split", () => {
    expect(canWrite("sales", "companies", "insert")).toBe(true);
    expect(canWrite("sales", "quotes", "update")).toBe(true);
    expect(canWrite("engineering", "requests", "update")).toBe(true);
    expect(canWrite("engineering", "requests", "insert")).toBe(false);
    expect(canWrite("supply", "manual_quotes", "insert")).toBe(true);
    expect(canWrite("supply", "assembly_prices", "update")).toBe(true);
    expect(canWrite("supply", "quotes", "update")).toBe(false);
    expect(canWrite("sales", "quote_settings", "update")).toBe(false);
    expect(canWrite("engineering", "cost_runs", "insert")).toBe(true);
    expect(canWrite("sales", "cost_runs", "insert")).toBe(false);
    expect(canWrite("supply", "part_inventory", "update")).toBe(true);
    expect(canWrite("supply", "finished_goods", "insert")).toBe(true);
    expect(canWrite("supply", "assembly_lots", "delete")).toBe(true);
    expect(canWrite("sales", "assembly_lots", "insert")).toBe(false);
  });

  it("lets admin write every table", () => {
    for (const table of tables) {
      for (const action of WRITE_ACTIONS)
        expect(canWrite("admin", table, action)).toBe(true);
    }
  });

  it("only lets admin change users", () => {
    for (const role of ROLES.filter((r) => r !== "admin")) {
      expect(canWrite(role, "users", "update")).toBe(false);
    }
  });
});
