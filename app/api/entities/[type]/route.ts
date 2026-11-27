import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/current-user";
import { searchEntities } from "@/lib/entities/search";
import { isEntityType } from "@/lib/entities/types";

type RouteContext = { params: Promise<{ type: string }> };

/**
 * Authenticated paginated entity search for EntityPicker.
 * Query: q, page, pageSize (default 25), companyId, pipelineId.
 */
export async function GET(request: Request, context: RouteContext) {
  await requireUser();
  const { type } = await context.params;
  if (!isEntityType(type)) {
    return NextResponse.json({ error: "Unknown entity type." }, { status: 400 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const pipelineRaw = url.searchParams.get("pipelineId");
  const pipelineId =
    pipelineRaw != null && pipelineRaw !== ""
      ? Number.parseInt(pipelineRaw, 10)
      : undefined;

  const result = await searchEntities({
    type,
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    companyId,
    pipelineId: Number.isFinite(pipelineId) ? pipelineId : undefined,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
