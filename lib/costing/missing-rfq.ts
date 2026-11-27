import "server-only";

import { inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { distributors, parts, rfqThreads } from "@/db/schema";
import { OPEN_RFQ_STATUSES } from "@/lib/rfq/subject-token";

export type MissingRfqItem = {
  mpn: string;
  partId: string | null;
  distributorId: string | null;
  distributorName: string | null;
  rfqEmail: string | null;
  threadStatus: string | null;
  ready: boolean;
};

/**
 * Builds the Ready-to-RFQ list from cost-run missing flags by resolving parts
 * and preferred distributor RFQ emails.
 */
export async function buildMissingRfqItems(
  flags: Array<Record<string, unknown>>,
): Promise<MissingRfqItem[]> {
  const mpns = [
    ...new Set(
      flags
        .filter((f) => f.code === "missing" && typeof f.mpn === "string")
        .map((f) => String(f.mpn).trim())
        .filter(Boolean),
    ),
  ];

  if (mpns.length === 0) return [];

  const db = getDb();
  const allParts = await db.select().from(parts);
  const byMpn = new Map(allParts.map((p) => [p.mpn.toLowerCase(), p] as const));

  const distributorIds = [
    ...new Set(
      mpns
        .map((m) => byMpn.get(m.toLowerCase())?.preferredDistributorId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const distRows =
    distributorIds.length > 0
      ? await db
          .select()
          .from(distributors)
          .where(inArray(distributors.id, distributorIds))
      : [];
  const distById = new Map(distRows.map((d) => [d.id, d]));

  const partIds = mpns
    .map((m) => byMpn.get(m.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));

  const threads =
    partIds.length > 0
      ? await db
          .select({
            partId: rfqThreads.partId,
            status: rfqThreads.status,
          })
          .from(rfqThreads)
          .where(inArray(rfqThreads.partId, partIds))
      : [];

  const openByPart = new Map<string, string>();
  const knownByPart = new Map<string, string>();
  for (const t of threads) {
    if ((OPEN_RFQ_STATUSES as readonly string[]).includes(t.status)) {
      openByPart.set(t.partId, t.status);
    }
    if (t.status === "confirmed") {
      knownByPart.set(t.partId, t.status);
    }
  }

  return mpns.map((mpn) => {
    const part = byMpn.get(mpn.toLowerCase()) ?? null;
    const dist =
      part?.preferredDistributorId != null
        ? (distById.get(part.preferredDistributorId) ?? null)
        : null;
    const threadStatus =
      (part && (openByPart.get(part.id) ?? knownByPart.get(part.id))) || null;
    return {
      mpn,
      partId: part?.id ?? null,
      distributorId: dist?.id ?? null,
      distributorName: dist?.name ?? null,
      rfqEmail: dist?.rfqEmail ?? null,
      threadStatus,
      ready: Boolean(part && dist?.rfqEmail && !openByPart.has(part.id)),
    };
  });
}
