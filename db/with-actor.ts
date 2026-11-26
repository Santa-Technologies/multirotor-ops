import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Runs work in a transaction with app.user_id set so audit triggers attribute
 * the change to the signed-in user when writing through DATABASE_URL.
 */
export async function withActor<T>(
  actorId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${actorId}, true)`);
    return work(tx);
  });
}
