import { describe, expect, it } from "vitest";

import { describeDbError } from "./db-error";

/** Builds an error shaped like postgres.js's PostgresError. */
function postgresError(fields: Record<string, string>) {
  return Object.assign(new Error(fields.message), fields);
}

/** Wraps a cause the way drizzle-orm's DrizzleQueryError does. */
function drizzleWrap(cause: unknown) {
  return Object.assign(
    new Error(
      'Failed query: insert into "users" ...\nparams: user-1,justus@kern.example',
    ),
    { cause },
  );
}

describe("describeDbError", () => {
  it("unwraps Drizzle and reports the Postgres code without the query or params", () => {
    const summary = describeDbError(
      drizzleWrap(
        postgresError({ code: "42P01", message: 'relation "users" does not exist' }),
      ),
    );

    expect(summary).toEqual({
      code: "42P01",
      message: 'relation "users" does not exist',
      detail: undefined,
      hint: undefined,
      table: undefined,
      constraint: undefined,
    });
    expect(JSON.stringify(summary)).not.toContain("justus@kern.example");
  });

  it("keeps constraint details for integrity errors", () => {
    const summary = describeDbError(
      drizzleWrap(
        postgresError({
          code: "23503",
          message: 'insert or update on table "users" violates foreign key constraint',
          table_name: "users",
          constraint_name: "users_id_users_id_fk",
        }),
      ),
    );

    expect(summary).toMatchObject({
      code: "23503",
      table: "users",
      constraint: "users_id_users_id_fk",
    });
  });

  it("reports network errors from the driver", () => {
    const err = Object.assign(new Error("getaddrinfo ENOTFOUND db.example.supabase.co"), {
      code: "ENOTFOUND",
    });

    expect(describeDbError(err)).toMatchObject({ code: "ENOTFOUND" });
  });

  it("reports a missing environment variable", () => {
    expect(
      describeDbError(
        new Error("Missing environment variable DATABASE_URL. See .env.example."),
      ),
    ).toMatchObject({
      message: "Missing environment variable DATABASE_URL. See .env.example.",
    });
  });

  it("never echoes the Drizzle query text when there is no cause", () => {
    expect(describeDbError(drizzleWrap(undefined)).message).toBe(
      "Query failed (no cause attached)",
    );
  });
});
