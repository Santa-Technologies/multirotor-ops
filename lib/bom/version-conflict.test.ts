import { describe, expect, it } from "vitest";

import {
  bomVersionAlreadyExistsMessage,
  bomVersionBlockedByCostRunsMessage,
  isBomVersionUniqueViolation,
} from "./version-conflict";

/** Builds an error shaped like postgres.js's PostgresError. */
function postgresError(fields: Record<string, string>) {
  return Object.assign(new Error(fields.message), fields);
}

/** Wraps a cause the way drizzle-orm's DrizzleQueryError does. */
function drizzleWrap(cause: unknown) {
  return Object.assign(
    new Error(
      'Failed query: insert into "bom_versions" ...\nparams: 12e00a81,2026-11,true,',
    ),
    { cause },
  );
}

describe("bom version conflict helpers", () => {
  it("explains cost-run blocks clearly", () => {
    expect(bomVersionBlockedByCostRunsMessage("2026-11")).toContain("2026-11");
    expect(bomVersionBlockedByCostRunsMessage("2026-11")).toContain("cost runs");
  });

  it("explains duplicate version labels clearly", () => {
    expect(bomVersionAlreadyExistsMessage("2026-11")).toContain("2026-11");
    expect(bomVersionAlreadyExistsMessage("2026-11")).toMatch(/delete|new version/i);
  });

  it("detects bom_versions unique violations from Drizzle-wrapped Postgres errors", () => {
    expect(
      isBomVersionUniqueViolation(
        drizzleWrap(
          postgresError({
            code: "23505",
            message:
              'duplicate key value violates unique constraint "bom_versions_productId_version_unique"',
            constraint_name: "bom_versions_productId_version_unique",
            table_name: "bom_versions",
          }),
        ),
      ),
    ).toBe(true);
  });

  it("ignores other unique violations", () => {
    expect(
      isBomVersionUniqueViolation(
        drizzleWrap(
          postgresError({
            code: "23505",
            message: 'duplicate key value violates unique constraint "products_name_unique"',
            constraint_name: "products_name_unique",
            table_name: "products",
          }),
        ),
      ),
    ).toBe(false);
  });
});
