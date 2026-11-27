import { describe, expect, it } from "vitest";

import { selectOrphanPartIds } from "./orphan-parts";

describe("selectOrphanPartIds", () => {
  it("keeps parts still used elsewhere", () => {
    expect(selectOrphanPartIds(["a", "b", "c"], new Set(["b"]))).toEqual([
      "a",
      "c",
    ]);
  });

  it("dedupes candidate ids", () => {
    expect(selectOrphanPartIds(["a", "a", "b"], new Set())).toEqual(["a", "b"]);
  });

  it("returns empty when every candidate is still used", () => {
    expect(
      selectOrphanPartIds(["a", "b"], new Set(["a", "b", "c"])),
    ).toEqual([]);
  });
});
