import { describe, expect, it } from "vitest";

import { createSubjectToken, extractSubjectToken } from "./subject-token";

describe("subject-token", () => {
  it("creates RFQ-XXXXXX tokens", () => {
    expect(createSubjectToken()).toMatch(/^RFQ-[A-F0-9]{6}$/);
  });

  it("extracts the token from a subject line", () => {
    expect(extractSubjectToken("Price request BMI088 [RFQ-A1B2C3]")).toBe(
      "RFQ-A1B2C3",
    );
    expect(extractSubjectToken("Re: RFQ-dead01 quote")).toBe("RFQ-DEAD01");
    expect(extractSubjectToken("No token here")).toBeNull();
  });
});
