import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { bomLines, bomVersions, parts, productLines, products } from "@/db/schema";

/** Lists product lines with their variants for the products index. */
export async function listProductLinesWithVariants() {
  const db = getDb();
  const lines = await db
    .select()
    .from(productLines)
    .orderBy(asc(productLines.name));

  const variants = await db
    .select()
    .from(products)
    .orderBy(asc(products.name));

  return lines.map((line) => ({
    ...line,
    variants: variants.filter((v) => v.productLineId === line.id),
  }));
}

/** Loads one variant with its product line and current BOM summary. */
export async function getVariantDetail(productId: string) {
  const db = getDb();
  const [variant] = await db
    .select({
      product: products,
      line: productLines,
    })
    .from(products)
    .innerJoin(productLines, eq(productLines.id, products.productLineId))
    .where(eq(products.id, productId))
    .limit(1);

  if (!variant) return null;

  const [currentBom] = await db
    .select()
    .from(bomVersions)
    .where(eq(bomVersions.productId, productId))
    .orderBy(desc(bomVersions.isCurrent), desc(bomVersions.createdAt))
    .limit(1);

  let lines: Array<{
    id: string;
    qtyPerBoard: number;
    designators: string | null;
    sourcing: "distributor" | "direct_quote";
    alternates: string[];
    part: typeof parts.$inferSelect;
  }> = [];

  if (currentBom) {
    lines = await db
      .select({
        id: bomLines.id,
        qtyPerBoard: bomLines.qtyPerBoard,
        designators: bomLines.designators,
        sourcing: bomLines.sourcing,
        alternates: bomLines.alternates,
        part: parts,
      })
      .from(bomLines)
      .innerJoin(parts, eq(parts.id, bomLines.partId))
      .where(eq(bomLines.bomVersionId, currentBom.id))
      .orderBy(asc(parts.mpn));
  }

  const versions = await db
    .select()
    .from(bomVersions)
    .where(eq(bomVersions.productId, productId))
    .orderBy(desc(bomVersions.createdAt));

  return { ...variant, currentBom, lines, versions };
}

/** Parts catalog with the product names that use each part. */
export async function listPartsWithUsage() {
  const db = getDb();
  const rows = await db
    .select({
      part: parts,
      usedIn: sql<string[]>`coalesce(
        array_agg(distinct ${products.name}) filter (where ${products.id} is not null),
        '{}'::text[]
      )`,
    })
    .from(parts)
    .leftJoin(bomLines, eq(bomLines.partId, parts.id))
    .leftJoin(bomVersions, eq(bomVersions.id, bomLines.bomVersionId))
    .leftJoin(products, eq(products.id, bomVersions.productId))
    .groupBy(parts.id)
    .orderBy(asc(parts.mpn));

  return rows;
}
