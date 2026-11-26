import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { quotes } from "@/db/schema";

/**
 * Allocates the next quote number MR-YYYY-NNNN for the given calendar year
 * by reading the highest existing sequence for that year.
 */
export async function nextQuoteNumber(asOf = new Date()): Promise<string> {
  const year = asOf.getUTCFullYear();
  const prefix = `MR-${year}-`;
  const db = getDb();
  const [row] = await db
    .select({
      maxSeq: sql<number>`coalesce(max(substring(${quotes.number} from 9)::int), 0)`,
    })
    .from(quotes)
    .where(sql`${quotes.number} like ${`${prefix}%`}`);

  const next = (row?.maxSeq ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
