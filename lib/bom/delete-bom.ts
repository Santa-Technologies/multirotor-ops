import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bomLines,
  bomVersions,
  costRuns,
  partInventory,
  parts,
  partSuppliers,
  rfqThreads,
} from "@/db/schema";

import { selectOrphanPartIds } from "./orphan-parts";

export type DeleteBomInput = {
  bomVersionId: string;
  actorId: string;
};

export type DeleteBomResult = {
  productId: string;
  version: string;
  linesRemoved: number;
  orphansRemoved: number;
};

/**
 * Deletes one BOM version and its lines. Shared parts stay unless unused by
 * every other BOM, inventory, RFQ thread, and part_suppliers row. Refuses when
 * cost runs still reference the version.
 */
export async function deleteBom(input: DeleteBomInput): Promise<DeleteBomResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${input.actorId}, true)`);

    const [version] = await tx
      .select()
      .from(bomVersions)
      .where(eq(bomVersions.id, input.bomVersionId))
      .limit(1);

    if (!version) {
      throw new Error("BOM version not found.");
    }

    const [costRun] = await tx
      .select({ id: costRuns.id })
      .from(costRuns)
      .where(eq(costRuns.bomVersionId, version.id))
      .limit(1);

    if (costRun) {
      throw new Error(
        "This BOM version has cost runs. Import a new version instead of deleting, or remove cost runs first.",
      );
    }

    const lines = await tx
      .select({ id: bomLines.id, partId: bomLines.partId })
      .from(bomLines)
      .where(eq(bomLines.bomVersionId, version.id));

    const candidatePartIds = lines.map((l) => l.partId);

    await tx.delete(bomLines).where(eq(bomLines.bomVersionId, version.id));
    await tx.delete(bomVersions).where(eq(bomVersions.id, version.id));

    // Promote the newest remaining version when we removed the current one.
    if (version.isCurrent) {
      const [next] = await tx
        .select({ id: bomVersions.id })
        .from(bomVersions)
        .where(eq(bomVersions.productId, version.productId))
        .orderBy(sql`${bomVersions.createdAt} desc`)
        .limit(1);
      if (next) {
        await tx
          .update(bomVersions)
          .set({ isCurrent: true })
          .where(eq(bomVersions.id, next.id));
      }
    }

    let orphansRemoved = 0;
    if (candidatePartIds.length > 0) {
      const stillUsed = new Set<string>();

      const otherLines = await tx
        .select({ partId: bomLines.partId })
        .from(bomLines)
        .where(inArray(bomLines.partId, candidatePartIds));
      for (const row of otherLines) stillUsed.add(row.partId);

      const inventory = await tx
        .select({ partId: partInventory.partId })
        .from(partInventory)
        .where(inArray(partInventory.partId, candidatePartIds));
      for (const row of inventory) stillUsed.add(row.partId);

      const threads = await tx
        .select({ partId: rfqThreads.partId })
        .from(rfqThreads)
        .where(inArray(rfqThreads.partId, candidatePartIds));
      for (const row of threads) stillUsed.add(row.partId);

      const links = await tx
        .select({ partId: partSuppliers.partId })
        .from(partSuppliers)
        .where(inArray(partSuppliers.partId, candidatePartIds));
      for (const row of links) stillUsed.add(row.partId);

      const orphans = selectOrphanPartIds(candidatePartIds, stillUsed);
      if (orphans.length > 0) {
        await tx.delete(parts).where(inArray(parts.id, orphans));
        orphansRemoved = orphans.length;
      }
    }

    return {
      productId: version.productId,
      version: version.version,
      linesRemoved: lines.length,
      orphansRemoved,
    };
  });
}

/** True when no cost run references this BOM version. */
export async function bomVersionIsDeletable(bomVersionId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: costRuns.id })
    .from(costRuns)
    .where(eq(costRuns.bomVersionId, bomVersionId))
    .limit(1);
  return !row;
}
