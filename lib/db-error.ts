export type DbErrorSummary = {
  /** Postgres SQLSTATE (e.g. 42P01) or Node network code (e.g. ENOTFOUND). */
  code?: string;
  message: string;
  detail?: string;
  hint?: string;
  table?: string;
  constraint?: string;
};

type ErrorLike = Error & {
  code?: unknown;
  detail?: unknown;
  hint?: unknown;
  table_name?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
};

const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/**
 * Reduces a database error to fields that are safe to log. Drizzle wraps the
 * Postgres error in DrizzleQueryError (message = SQL + parameters), so the
 * innermost cause is used and the query and parameters are never included.
 */
export function describeDbError(err: unknown): DbErrorSummary {
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    const cause = (current as ErrorLike | null)?.cause;
    if (!(cause instanceof Error)) break;
    current = cause;
  }

  if (!(current instanceof Error)) return { message: String(current) };
  const e = current as ErrorLike;
  const isDrizzleWrapper = e.message.startsWith("Failed query:");

  return {
    code: str(e.code),
    message: isDrizzleWrapper ? "Query failed (no cause attached)" : e.message,
    detail: str(e.detail),
    hint: str(e.hint),
    table: str(e.table_name),
    constraint: str(e.constraint_name),
  };
}
