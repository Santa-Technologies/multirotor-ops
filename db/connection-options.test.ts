import { describe, expect, it } from "vitest";

import { sslOptionFor } from "./connection-options";

describe("sslOptionFor", () => {
  it("requires TLS for a Supabase pooler URL without sslmode", () => {
    expect(
      sslOptionFor(
        "postgresql://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe("require");
  });

  it("leaves an explicit sslmode to postgres.js", () => {
    expect(
      sslOptionFor("postgresql://u:p@db.example.com:5432/postgres?sslmode=disable"),
    ).toBe(undefined);
    expect(
      sslOptionFor("postgresql://u:p@db.example.com:5432/postgres?sslmode=verify-full"),
    ).toBe(undefined);
  });

  it("keeps local databases without TLS", () => {
    expect(sslOptionFor("postgresql://postgres:pw@localhost:5432/kern")).toBe(false);
    expect(sslOptionFor("postgresql://postgres:pw@127.0.0.1:5432/kern")).toBe(false);
  });

  it("does not guess for a malformed URL", () => {
    expect(sslOptionFor("not a url")).toBe(undefined);
  });
});
