import "server-only";

import { fetchJson } from "@/lib/pricing-providers/fetch-with-retry";

const API_BASE = "https://api.pipedrive.com/api/v2";

type CursorPage<T> = {
  success?: boolean;
  data?: T[] | null;
  additional_data?: {
    next_cursor?: string | null;
  };
  error?: string;
};

export type PipedriveOrg = {
  id: number;
  name?: string | null;
  address?: { country?: string | null } | string | null;
  website?: string | null;
};

export type PipedrivePerson = {
  id: number;
  name?: string | null;
  org_id?: number | null;
  emails?: Array<{ value?: string; primary?: boolean }> | null;
  phones?: Array<{ value?: string; primary?: boolean }> | null;
};

export type PipedriveDeal = {
  id: number;
  title?: string | null;
  status?: string | null;
  value?: number | null;
  currency?: string | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
  org_id?: number | null;
  person_id?: number | null;
  expected_close_date?: string | null;
};

export type PipedrivePipeline = {
  id: number;
  name?: string | null;
};

export type PipedriveStage = {
  id: number;
  name?: string | null;
  pipeline_id?: number | null;
  order_nr?: number | null;
  is_deleted?: boolean | null;
};

function apiToken(): string {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN is not configured.");
  return token;
}

/** GETs a Pipedrive v2 collection page with api_token auth. */
async function getPage<T>(
  path: string,
  query: Record<string, string | undefined> = {},
): Promise<CursorPage<T>> {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("api_token", apiToken());
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return fetchJson<CursorPage<T>>({
    url: url.toString(),
    method: "GET",
    label: `Pipedrive ${path}`,
  });
}

/** Walks cursor pagination until exhausted (or maxPages). */
export async function listAllPipedrive<T>(
  path: string,
  query: Record<string, string | undefined> = {},
  maxPages = 50,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await getPage<T>(path, {
      ...query,
      limit: "500",
      cursor,
    });
    if (result.success === false) {
      throw new Error(result.error ?? `Pipedrive ${path} failed.`);
    }
    out.push(...(result.data ?? []));
    const next = result.additional_data?.next_cursor;
    if (!next) break;
    cursor = next;
  }
  return out;
}

export async function listOrganizations() {
  return listAllPipedrive<PipedriveOrg>("/organizations");
}

export async function listPersons() {
  return listAllPipedrive<PipedrivePerson>("/persons");
}

export async function listOpenDeals() {
  return listAllPipedrive<PipedriveDeal>("/deals", { status: "open" });
}

export async function listPipelines() {
  return listAllPipedrive<PipedrivePipeline>("/pipelines");
}

/**
 * Stages for one pipeline (Pipedrive order). Prefer this over a global list so
 * every pipeline is explicitly covered even when the unfiltered endpoint is sparse.
 */
export async function listStagesForPipeline(pipelineId: number) {
  const stages = await listAllPipedrive<PipedriveStage>("/stages", {
    pipeline_id: String(pipelineId),
    sort_by: "order_nr",
  });
  return stages.filter((s) => !s.is_deleted);
}

/**
 * Stages for every pipeline. Fetches per pipeline so columns stay complete even
 * when a company has multiple pipelines. Pass `pipelines` when the caller
 * already loaded them to avoid a second /pipelines round-trip.
 */
export async function listStages(pipelines?: PipedrivePipeline[]) {
  const pipes = pipelines ?? (await listPipelines());
  if (pipes.length === 0) {
    const stages = await listAllPipedrive<PipedriveStage>("/stages", {
      sort_by: "order_nr",
    });
    return stages.filter((s) => !s.is_deleted);
  }
  const perPipeline = await Promise.all(
    pipes.filter((p) => p.id != null).map((p) => listStagesForPipeline(p.id)),
  );
  const byId = new Map<number, PipedriveStage>();
  for (const stage of perPipeline.flat()) {
    if (stage.id != null) byId.set(stage.id, stage);
  }
  return [...byId.values()];
}
