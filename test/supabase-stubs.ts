import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "postgres";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

// The parts of a Supabase database the migrations rely on: the auth schema with
// auth.users and auth.uid(), the anon/authenticated roles, and Supabase's
// default grants on new public tables.
const SUPABASE_STUBS = `
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email varchar(255));
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
`;

/** Refuses to touch anything but a database whose name ends in `_test`. */
export function assertDisposableDatabase(url: string) {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL must name a disposable database ending in _test, got "${name}".`,
    );
  }
}

/** Wipes the test database and recreates the Supabase stand-ins. */
export async function resetDatabase(sql: Sql) {
  await sql.unsafe(SUPABASE_STUBS);
}

/** Applies migrations; with `count`, only the first `count` journal entries. */
export async function migrateDatabase(sql: Sql, count?: number) {
  let folder = MIGRATIONS_FOLDER;
  if (count !== undefined) {
    folder = mkdtempSync(join(tmpdir(), "kern-migrations-"));
    cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
    const journalPath = join(folder, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.slice(0, count);
    writeFileSync(journalPath, JSON.stringify(journal));
  }
  await migrate(drizzle(sql), { migrationsFolder: folder });
}

/** Runs fn as a signed-in Supabase user: role `authenticated` with the user's JWT subject. */
export async function asUser<T>(sql: Sql, userId: string, fn: (tx: Sql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}
