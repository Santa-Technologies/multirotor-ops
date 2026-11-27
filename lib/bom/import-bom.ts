import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { bomLines, bomVersions, distributors, parts } from "@/db/schema";

import { distributorFromHost } from "./distributor-host";
import type { ParsedBomRow } from "./parse-csv";

export type ImportBomInput = {
  productId: string;
  version: string;
  notes?: string | null;
  rows: ParsedBomRow[];
  /** When true, marks this version current and clears the previous current flag. */
  makeCurrent?: boolean;
  actorId: string;
};

export type ImportBomResult = {
  bomVersionId: string;
  partIds: string[];
  lineCount: number;
};

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Upserts parts by case-insensitive MPN, creates a bom_version, and inserts
 * lines that only store part_id. Shared parts across variants reuse one row.
 * BOM Link host → distributor upsert (no scraping).
 */
export async function importBom(input: ImportBomInput): Promise<ImportBomResult> {
  if (input.rows.length === 0) {
    throw new Error("BOM has no valid rows to import.");
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${input.actorId}, true)`);

    const hostToDistributorId = new Map<string, string>();

    const partIds: string[] = [];
    for (const row of input.rows) {
      let preferredDistributorId: string | null = null;
      if (row.distributorHostKey) {
        preferredDistributorId = await ensureDistributor(
          tx,
          row.distributorHostKey,
          hostToDistributorId,
        );
      }

      const [existing] = await tx
        .select({ id: parts.id })
        .from(parts)
        .where(sql`lower(${parts.mpn}) = lower(${row.mpn})`)
        .limit(1);

      if (existing) {
        await tx
          .update(parts)
          .set({
            manufacturer: row.manufacturer ?? undefined,
            description: row.description ?? undefined,
            defaultSourcing: row.sourcing,
            productUrl: row.productUrl ?? undefined,
            preferredDistributorId: preferredDistributorId ?? undefined,
          })
          .where(eq(parts.id, existing.id));
        partIds.push(existing.id);
        continue;
      }

      const [created] = await tx
        .insert(parts)
        .values({
          mpn: row.mpn,
          manufacturer: row.manufacturer,
          description: row.description,
          defaultSourcing: row.sourcing,
          productUrl: row.productUrl,
          preferredDistributorId,
        })
        .returning({ id: parts.id });
      partIds.push(created!.id);
    }

    if (input.makeCurrent !== false) {
      await tx
        .update(bomVersions)
        .set({ isCurrent: false })
        .where(
          and(eq(bomVersions.productId, input.productId), eq(bomVersions.isCurrent, true)),
        );
    }

    const [version] = await tx
      .insert(bomVersions)
      .values({
        productId: input.productId,
        version: input.version,
        isCurrent: input.makeCurrent !== false,
        notes: input.notes ?? null,
      })
      .returning({ id: bomVersions.id });

    await tx.insert(bomLines).values(
      input.rows.map((row, index) => ({
        bomVersionId: version!.id,
        partId: partIds[index]!,
        qtyPerBoard: row.qtyPerBoard,
        designators: row.designators,
        sourcing: row.sourcing,
        alternates: row.alternates,
        productUrl: row.productUrl,
      })),
    );

    return {
      bomVersionId: version!.id,
      partIds,
      lineCount: input.rows.length,
    };
  });
}

/** Upserts a distributor row from a known BOM Link host key. */
async function ensureDistributor(
  tx: Tx,
  hostKey: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const cached = cache.get(hostKey);
  if (cached) return cached;

  const known = distributorFromHost(hostKey);
  if (!known) return null;

  const [byHost] = await tx
    .select({ id: distributors.id })
    .from(distributors)
    .where(eq(distributors.hostKey, known.hostKey))
    .limit(1);

  if (byHost) {
    cache.set(hostKey, byHost.id);
    return byHost.id;
  }

  const [byName] = await tx
    .select({ id: distributors.id })
    .from(distributors)
    .where(eq(distributors.name, known.name))
    .limit(1);

  if (byName) {
    await tx
      .update(distributors)
      .set({
        hostKey: known.hostKey,
        approved: known.approved,
        country: known.country,
      })
      .where(eq(distributors.id, byName.id));
    cache.set(hostKey, byName.id);
    return byName.id;
  }

  const [created] = await tx
    .insert(distributors)
    .values({
      name: known.name,
      hostKey: known.hostKey,
      approved: known.approved,
      country: known.country,
    })
    .returning({ id: distributors.id });

  cache.set(hostKey, created!.id);
  return created!.id;
}
