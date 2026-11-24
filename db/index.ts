import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";

import { sslOptionFor } from "./connection-options";
import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

let cached: Database | undefined;

/** Builds the Drizzle client on top of a postgres.js connection. */
function createDb() {
  const url = getDatabaseUrl();
  const ssl = sslOptionFor(url);
  // prepare: false is required by the Supabase transaction pooler (port 6543).
  const client = postgres(url, {
    prepare: false,
    max: 1,
    ...(ssl === undefined ? {} : { ssl }),
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Returns a lazily created Drizzle client so builds do not need DATABASE_URL. */
export function getDb(): Database {
  cached ??= createDb();
  return cached;
}
