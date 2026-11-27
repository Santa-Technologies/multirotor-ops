import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { distributors, suppliers } from "@/db/schema";
import { withActor } from "@/db/with-actor";

/**
 * Resolves an RFQ-sendable supplier from a distributor with rfqEmail.
 * Creates/aliases a suppliers row so existing RFQ thread FKs keep working.
 */
export async function ensureSupplierForDistributor(
  distributorId: string,
  actorId: string,
): Promise<{ supplierId: string; email: string } | { error: string }> {
  const db = getDb();
  const [dist] = await db
    .select()
    .from(distributors)
    .where(eq(distributors.id, distributorId))
    .limit(1);
  if (!dist) return { error: "Distributor not found." };
  if (!dist.rfqEmail?.trim()) {
    return { error: "Set the distributor RFQ email before sending." };
  }

  const email = dist.rfqEmail.trim().toLowerCase();

  return withActor(actorId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(suppliers)
      .where(sql`lower(${suppliers.email}) = ${email}`)
      .limit(1);
    if (existing) {
      return { supplierId: existing.id, email: existing.email };
    }

    const [created] = await tx
      .insert(suppliers)
      .values({
        name: dist.rfqContactName?.trim() || dist.name,
        email: dist.rfqEmail!.trim(),
        notes: `Mirrored from distributor ${dist.name}`,
        active: true,
      })
      .returning();
    return { supplierId: created!.id, email: created!.email };
  });
}
