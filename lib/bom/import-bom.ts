import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { bomLines, bomVersions, parts } from "@/db/schema";

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

/**
 * Upserts parts by case-insensitive MPN, creates a bom_version, and inserts
 * lines that only store part_id. Shared parts across variants reuse one row.
 */
export async function importBom(input: ImportBomInput): Promise<ImportBomResult> {
  if (input.rows.length === 0) {
    throw new Error("BOM has no valid rows to import.");
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${input.actorId}, true)`);

    const partIds: string[] = [];
    for (const row of input.rows) {
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
      })),
    );

    return {
      bomVersionId: version!.id,
      partIds,
      lineCount: input.rows.length,
    };
  });
}
