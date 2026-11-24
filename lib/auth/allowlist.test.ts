import { describe, expect, it } from "vitest";

import { findAllowedEntry, isEmailAllowed, parseAllowlist } from "./allowlist";

const RAW = "justus@kern.example:admin, Nils@Kern.example:sales,marc@kern.example";

describe("parseAllowlist", () => {
  it("normalises emails and reads optional roles", () => {
    expect(parseAllowlist(RAW)).toEqual([
      { email: "justus@kern.example", role: "admin" },
      { email: "nils@kern.example", role: "sales" },
      { email: "marc@kern.example", role: "sales" },
    ]);
  });

  it("returns an empty list when the variable is missing or empty", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist(" , ")).toEqual([]);
  });

  it("drops malformed entries instead of allowing them", () => {
    expect(
      parseAllowlist("not-an-email, volker@kern.example:superuser, a@b.example:admin:x"),
    ).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("accepts allowlisted emails regardless of case and whitespace", () => {
    expect(isEmailAllowed("justus@kern.example", RAW)).toBe(true);
    expect(isEmailAllowed("  NILS@kern.EXAMPLE ", RAW)).toBe(true);
  });

  it("rejects an email that is not on the allowlist", () => {
    expect(isEmailAllowed("intruder@example.com", RAW)).toBe(false);
  });

  it("rejects look-alike emails", () => {
    expect(isEmailAllowed("justus@kern.example.evil.com", RAW)).toBe(false);
    expect(isEmailAllowed("xjustus@kern.example", RAW)).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(isEmailAllowed("justus@kern.example", "")).toBe(false);
    expect(isEmailAllowed("justus@kern.example", undefined)).toBe(false);
  });

  it("rejects missing emails", () => {
    expect(isEmailAllowed(null, RAW)).toBe(false);
    expect(isEmailAllowed(undefined, RAW)).toBe(false);
  });
});

describe("findAllowedEntry", () => {
  it("returns the role used to seed users.role on first login", () => {
    expect(findAllowedEntry("justus@kern.example", RAW)?.role).toBe("admin");
  });
});
