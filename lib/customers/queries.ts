import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  companies,
  contacts,
  pipedriveDeals,
  pipedriveStages,
  quotes,
  requests,
  salesOrders,
} from "@/db/schema";

/** Distinct pipelines present on open deals (for the kanban filter). */
export async function listOpenDealPipelines() {
  const db = getDb();
  return db
    .selectDistinct({
      pipelineId: pipedriveDeals.pipelineId,
      pipelineName: pipedriveDeals.pipelineName,
    })
    .from(pipedriveDeals)
    .where(
      and(eq(pipedriveDeals.status, "open"), sql`${pipedriveDeals.pipelineId} is not null`),
    )
    .orderBy(asc(pipedriveDeals.pipelineName));
}

/** Stages for a pipeline ordered by Pipedrive order_nr. */
export async function listStagesForPipeline(pipelineId: number) {
  const db = getDb();
  const stages = await db
    .select()
    .from(pipedriveStages)
    .where(eq(pipedriveStages.pipelineId, pipelineId))
    .orderBy(asc(pipedriveStages.orderNr), asc(pipedriveStages.name));

  if (stages.length > 0) return stages;

  // Fallback when stages were never synced: synthesise columns from open deals.
  const fromDeals = await db
    .select({
      stageId: pipedriveDeals.stageId,
      stageName: pipedriveDeals.stageName,
    })
    .from(pipedriveDeals)
    .where(
      and(
        eq(pipedriveDeals.status, "open"),
        eq(pipedriveDeals.pipelineId, pipelineId),
        sql`${pipedriveDeals.stageId} is not null`,
      ),
    )
    .orderBy(asc(pipedriveDeals.stageId));

  const byId = new Map<number, string>();
  for (const row of fromDeals) {
    if (row.stageId == null || byId.has(row.stageId)) continue;
    byId.set(row.stageId, row.stageName?.trim() || `Stage ${row.stageId}`);
  }

  return [...byId.entries()].map(([stageId, name], index) => ({
    id: "00000000-0000-0000-0000-000000000000",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: null as string | null,
    pipelineId,
    stageId,
    name,
    orderNr: index,
  }));
}

/** Open deals for a pipeline (kanban cards). */
export async function listOpenDealsForPipeline(pipelineId: number) {
  const db = getDb();
  return db
    .select({
      deal: pipedriveDeals,
      companyName: companies.name,
      contactName: contacts.name,
    })
    .from(pipedriveDeals)
    .leftJoin(companies, eq(companies.id, pipedriveDeals.companyId))
    .leftJoin(contacts, eq(contacts.id, pipedriveDeals.contactId))
    .where(
      and(
        eq(pipedriveDeals.status, "open"),
        eq(pipedriveDeals.pipelineId, pipelineId),
      ),
    )
    .orderBy(asc(pipedriveDeals.title));
}

/** Full deal detail with linked commercial objects. */
export async function getDealDetail(dealUuid: string) {
  const db = getDb();
  const [row] = await db
    .select({
      deal: pipedriveDeals,
      company: companies,
      contact: contacts,
    })
    .from(pipedriveDeals)
    .leftJoin(companies, eq(companies.id, pipedriveDeals.companyId))
    .leftJoin(contacts, eq(contacts.id, pipedriveDeals.contactId))
    .where(eq(pipedriveDeals.id, dealUuid))
    .limit(1);

  if (!row) return null;

  const [linkedRequests, linkedQuotes, linkedOrders] = await Promise.all([
    db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.dealId, dealUuid),
        ),
      )
      .orderBy(desc(requests.createdAt))
      .limit(50),
    db
      .select()
      .from(quotes)
      .where(eq(quotes.dealId, dealUuid))
      .orderBy(desc(quotes.createdAt))
      .limit(50),
    db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.dealId, dealUuid))
      .orderBy(desc(salesOrders.createdAt))
      .limit(50),
  ]);

  // Also match legacy integer pipedriveDealId when dealId uuid is unset.
  const legacyRequests =
    linkedRequests.length === 0
      ? await db
          .select()
          .from(requests)
          .where(eq(requests.pipedriveDealId, row.deal.pipedriveId))
          .orderBy(desc(requests.createdAt))
          .limit(50)
      : linkedRequests;

  const legacyQuotes =
    linkedQuotes.length === 0
      ? await db
          .select()
          .from(quotes)
          .where(eq(quotes.pipedriveDealId, row.deal.pipedriveId))
          .orderBy(desc(quotes.createdAt))
          .limit(50)
      : linkedQuotes;

  return {
    ...row,
    requests: legacyRequests,
    quotes: legacyQuotes,
    orders: linkedOrders,
  };
}
