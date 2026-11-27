import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { PageHeaderActions } from "@/components/page-header-actions";
import { PageLoading } from "@/components/page-loading";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  listOpenDealPipelines,
  listOpenDealsForPipeline,
  listStagesForPipeline,
} from "@/lib/customers/queries";

import { SyncPipedriveForm } from "./forms";
import { DealsKanban } from "./kanban";

export const metadata: Metadata = { title: "Customers" };

type PageProps = {
  searchParams: Promise<{ pipeline?: string }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const canSync = canWrite(user.role, "pipedrive_deals", "insert");
  const params = await searchParams;

  return (
    <section className="flex flex-col gap-8">
      <PageHeaderActions
        title="Customers"
        description="Pipedrive deals by stage (read-only). Companies and contacts sync from Pipedrive — no local create. Open a card for request, quote and order actions."
        actions={canSync ? <SyncPipedriveForm /> : null}
      />

      <Suspense fallback={<PageLoading label="Loading pipeline…" />}>
        <CustomersBoard pipelineParam={params.pipeline} />
      </Suspense>
    </section>
  );
}

/** Slow board data streams behind Suspense so the page chrome paints first. */
async function CustomersBoard({ pipelineParam }: { pipelineParam?: string }) {
  await requireUser();
  const pipelines = await listOpenDealPipelines();
  const selectedId =
    pipelineParam != null && pipelineParam !== ""
      ? Number.parseInt(pipelineParam, 10)
      : (pipelines[0]?.pipelineId ?? null);

  const [stages, deals] =
    selectedId != null && Number.isFinite(selectedId)
      ? await Promise.all([
          listStagesForPipeline(selectedId),
          listOpenDealsForPipeline(selectedId),
        ])
      : [[], []];

  if (pipelines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mirrored open deals yet. Run a Pipedrive refresh when the API token is set.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {pipelines.map((p) => {
          if (p.pipelineId == null) return null;
          const active = p.pipelineId === selectedId;
          return (
            <Link
              key={p.pipelineId}
              href={`/customers?pipeline=${p.pipelineId}`}
              scroll={false}
              className={
                active
                  ? "inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
                  : "inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
              }
            >
              {p.pipelineName ?? `Pipeline ${p.pipelineId}`}
            </Link>
          );
        })}
      </div>
      <DealsKanban stages={stages} deals={deals} />
    </>
  );
}
