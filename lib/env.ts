/** Reads a required environment variable and throws a clear error when it is missing. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

/**
 * Supabase URL and publishable key. Both are public by design and safe in the browser.
 * NEXT_PUBLIC_* values must be read with literal property access so Next.js can inline them.
 */
export function getSupabasePublicEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

/** Postgres connection string used by Drizzle on the server. */
export function getDatabaseUrl(): string {
  return required("DATABASE_URL", process.env.DATABASE_URL);
}
