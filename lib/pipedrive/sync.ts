import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { companies, contacts, pipedriveDeals, pipedriveStages } from "@/db/schema";
import { withActor } from "@/db/with-actor";

import {
  listOpenDeals,
  listOrganizations,
  listPersons,
  listPipelines,
  listStages,
  type PipedriveDeal,
  type PipedriveOrg,
  type PipedrivePerson,
  type PipedriveStage,
} from "./client";

export type PipedriveSyncResult = {
  organizations: number;
  persons: number;
  deals: number;
  stages: number;
};

function primaryEmail(person: PipedrivePerson): string | null {
  const emails = person.emails ?? [];
  const primary = emails.find((e) => e.primary) ?? emails[0];
  return primary?.value?.trim() || null;
}

function primaryPhone(person: PipedrivePerson): string | null {
  const phones = person.phones ?? [];
  const primary = phones.find((p) => p.primary) ?? phones[0];
  return primary?.value?.trim() || null;
}

function orgCountry(org: PipedriveOrg): string | null {
  if (!org.address) return null;
  if (typeof org.address === "string") return null;
  return org.address.country?.trim() || null;
}

function dealStatus(
  status: string | null | undefined,
): "open" | "won" | "lost" | "deleted" {
  if (status === "won" || status === "lost" || status === "deleted") return status;
  return "open";
}

/**
 * One-way import: upserts organizations → companies, persons → contacts,
 * open deals → pipedrive_deals. Never writes back to Pipedrive.
 */
export async function syncPipedrive(actorId: string): Promise<PipedriveSyncResult> {
  const [orgs, persons, deals, pipelines] = await Promise.all([
    listOrganizations(),
    listPersons(),
    listOpenDeals(),
    listPipelines(),
  ]);
  // Per-pipeline stage fetch (uses pipelines already loaded above).
  const stages = await listStages(pipelines);

  const pipelineName = new Map(pipelines.map((p) => [p.id, p.name ?? null]));
  const stageName = new Map(stages.map((s) => [s.id, s.name ?? null]));

  return withActor(actorId, async (tx) => {
    const orgLocalId = new Map<number, string>();

    for (const org of orgs) {
      if (!org.id || !org.name?.trim()) continue;
      const [row] = await tx
        .insert(companies)
        .values({
          name: org.name.trim(),
          country: orgCountry(org),
          website: org.website?.trim() || null,
          pipedriveId: org.id,
        })
        .onConflictDoUpdate({
          target: companies.pipedriveId,
          set: {
            name: org.name.trim(),
            country: orgCountry(org),
            website: org.website?.trim() || null,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: companies.id, pipedriveId: companies.pipedriveId });
      if (row?.pipedriveId != null) orgLocalId.set(row.pipedriveId, row.id);
    }

    // Reload map in case some orgs already existed without returning path issues.
    const companyRows = await tx
      .select({ id: companies.id, pipedriveId: companies.pipedriveId })
      .from(companies)
      .where(sql`${companies.pipedriveId} is not null`);
    for (const c of companyRows) {
      if (c.pipedriveId != null) orgLocalId.set(c.pipedriveId, c.id);
    }

    const personLocalId = new Map<number, string>();
    let personCount = 0;
    for (const person of persons) {
      if (!person.id || !person.name?.trim()) continue;
      const orgId = person.org_id ?? null;
      const companyId = orgId != null ? orgLocalId.get(orgId) : undefined;
      if (!companyId) continue;

      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.pipedriveId, person.id))
        .limit(1);

      if (existing) {
        await tx
          .update(contacts)
          .set({
            companyId,
            name: person.name.trim(),
            email: primaryEmail(person),
            phone: primaryPhone(person),
          })
          .where(eq(contacts.id, existing.id));
        personLocalId.set(person.id, existing.id);
      } else {
        const [created] = await tx
          .insert(contacts)
          .values({
            companyId,
            name: person.name.trim(),
            email: primaryEmail(person),
            phone: primaryPhone(person),
            pipedriveId: person.id,
          })
          .returning({ id: contacts.id });
        personLocalId.set(person.id, created!.id);
      }
      personCount++;
    }

    let stageCount = await upsertStages(tx, stages);

    // Backfill stage rows from open deals so kanban columns exist even when the
    // stages endpoint omitted a pipeline or a stage was renamed after sync.
    stageCount += await backfillStagesFromDeals(tx, deals, stageName);

    let dealCount = 0;
    const now = new Date();
    for (const deal of deals) {
      if (!deal.id || !deal.title?.trim()) continue;
      const orgPd = deal.org_id ?? null;
      const personPd = deal.person_id ?? null;
      const companyId = orgPd != null ? (orgLocalId.get(orgPd) ?? null) : null;
      const contactId =
        personPd != null ? (personLocalId.get(personPd) ?? null) : null;

      const resolvedStageName =
        deal.stage_id != null
          ? (stageName.get(deal.stage_id) ?? null)
          : null;

      await upsertDeal(tx, {
        deal,
        companyId,
        contactId,
        pipelineName: deal.pipeline_id != null ? pipelineName.get(deal.pipeline_id) ?? null : null,
        stageName: resolvedStageName,
        syncedAt: now,
      });
      dealCount++;
    }

    return {
      organizations: orgLocalId.size,
      persons: personCount,
      deals: dealCount,
      stages: stageCount,
    };
  });
}

/** Upserts stage rows for kanban column order (never written back to Pipedrive). */
async function upsertStages(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  stages: PipedriveStage[],
): Promise<number> {
  let n = 0;
  for (const stage of stages) {
    if (
      !stage.id ||
      stage.pipeline_id == null ||
      !stage.name?.trim() ||
      stage.is_deleted
    ) {
      continue;
    }
    n += await upsertStageRow(tx, {
      pipelineId: stage.pipeline_id,
      stageId: stage.id,
      name: stage.name.trim(),
      orderNr: stage.order_nr ?? 0,
    });
  }
  return n;
}

/**
 * Ensures every open deal's stage_id has a pipedrive_stages row for its pipeline.
 * Uses the stages name map when available; otherwise a placeholder name.
 */
async function backfillStagesFromDeals(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  deals: PipedriveDeal[],
  stageNameById: Map<number, string | null>,
): Promise<number> {
  const seen = new Set<string>();
  let n = 0;
  for (const deal of deals) {
    if (deal.stage_id == null || deal.pipeline_id == null) continue;
    const key = `${deal.pipeline_id}:${deal.stage_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [existing] = await tx
      .select({ id: pipedriveStages.id })
      .from(pipedriveStages)
      .where(
        and(
          eq(pipedriveStages.pipelineId, deal.pipeline_id),
          eq(pipedriveStages.stageId, deal.stage_id),
        ),
      )
      .limit(1);
    if (existing) continue;

    const name =
      stageNameById.get(deal.stage_id)?.trim() || `Stage ${deal.stage_id}`;
    n += await upsertStageRow(tx, {
      pipelineId: deal.pipeline_id,
      stageId: deal.stage_id,
      name,
      orderNr: deal.stage_id,
    });
  }
  return n;
}

async function upsertStageRow(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  values: {
    pipelineId: number;
    stageId: number;
    name: string;
    orderNr: number;
  },
): Promise<number> {
  const [existing] = await tx
    .select({ id: pipedriveStages.id })
    .from(pipedriveStages)
    .where(
      and(
        eq(pipedriveStages.pipelineId, values.pipelineId),
        eq(pipedriveStages.stageId, values.stageId),
      ),
    )
    .limit(1);
  if (existing) {
    await tx
      .update(pipedriveStages)
      .set(values)
      .where(eq(pipedriveStages.id, existing.id));
  } else {
    await tx.insert(pipedriveStages).values(values);
  }
  return 1;
}

async function upsertDeal(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  options: {
    deal: PipedriveDeal;
    companyId: string | null;
    contactId: string | null;
    pipelineName: string | null;
    stageName: string | null;
    syncedAt: Date;
  },
) {
  const { deal } = options;
  const [existing] = await tx
    .select({ id: pipedriveDeals.id })
    .from(pipedriveDeals)
    .where(eq(pipedriveDeals.pipedriveId, deal.id))
    .limit(1);

  const values = {
    title: deal.title!.trim(),
    status: dealStatus(deal.status),
    valueAmount: deal.value ?? null,
    currency: (deal.currency ?? "EUR").toUpperCase(),
    pipelineId: deal.pipeline_id ?? null,
    pipelineName: options.pipelineName,
    stageId: deal.stage_id ?? null,
    stageName: options.stageName,
    orgPipedriveId: deal.org_id ?? null,
    personPipedriveId: deal.person_id ?? null,
    companyId: options.companyId,
    contactId: options.contactId,
    expectedCloseDate: deal.expected_close_date ?? null,
    syncedAt: options.syncedAt,
  };

  if (existing) {
    await tx
      .update(pipedriveDeals)
      .set(values)
      .where(eq(pipedriveDeals.id, existing.id));
  } else {
    await tx.insert(pipedriveDeals).values({
      pipedriveId: deal.id,
      ...values,
    });
  }
}
