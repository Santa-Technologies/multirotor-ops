import { describe, expect, it } from "vitest";

/** Mirrors dealStatus() in sync.ts for a pure unit test. */
function dealStatus(
  status: string | null | undefined,
): "open" | "won" | "lost" | "deleted" {
  if (status === "won" || status === "lost" || status === "deleted") return status;
  return "open";
}

describe("pipedrive dealStatus", () => {
  it("normalises unknown values to open", () => {
    expect(dealStatus("open")).toBe("open");
    expect(dealStatus("won")).toBe("won");
    expect(dealStatus("lost")).toBe("lost");
    expect(dealStatus("weird")).toBe("open");
    expect(dealStatus(null)).toBe("open");
  });
});
