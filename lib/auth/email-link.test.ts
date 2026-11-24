import { describe, expect, it } from "vitest";

import { parseEmailLinkParams } from "./email-link";

const parse = (query: string) => parseEmailLinkParams(new URLSearchParams(query));

describe("parseEmailLinkParams", () => {
  it("reads token_hash with type email (current Supabase template)", () => {
    expect(parse("token_hash=abc&type=email")).toEqual({
      kind: "token_hash",
      tokenHash: "abc",
      type: "email",
    });
  });

  it("accepts the older magiclink type", () => {
    expect(parse("token_hash=abc&type=magiclink")).toMatchObject({ type: "magiclink" });
  });

  it("refuses OTP types that are not sign-in", () => {
    expect(parse("token_hash=abc&type=recovery")).toEqual({ kind: "invalid" });
    expect(parse("token_hash=abc&type=invite")).toEqual({ kind: "invalid" });
    expect(parse("token_hash=abc")).toEqual({ kind: "invalid" });
  });

  it("falls back to the PKCE code from the default template", () => {
    expect(parse("code=xyz")).toEqual({ kind: "code", code: "xyz" });
  });

  it("prefers token_hash when both are present", () => {
    expect(parse("code=xyz&token_hash=abc&type=email").kind).toBe("token_hash");
  });

  it("is invalid when Supabase only sent an error", () => {
    expect(parse("error=access_denied&error_code=otp_expired")).toEqual({
      kind: "invalid",
    });
  });
});
