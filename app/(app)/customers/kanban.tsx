import Link from "next/link";

import type { pipedriveDeals, pipedriveStages } from "@/db/schema";

type DealRow = {
  deal: typeof pipedriveDeals.$inferSelect;
  companyName: string | null;
  contactName: string | null;
};

type StageRow = typeof pipedriveStages.$inferSelect;

/**
 * Read-only Pipedrive stage columns. Cards link to deal detail; stages are
 * never written back.
 */
export function DealsKanban({
  stages,
  deals,
}: {
  stages: StageRow[];
  deals: DealRow[];
}) {
  const byStage = new Map<number | "unassigned", DealRow[]>();
  for (const stage of stages) byStage.set(stage.stageId, []);
  byStage.set("unassigned", []);

  for (const row of deals) {
    const key =
      row.deal.stageId != null && byStage.has(row.deal.stageId)
        ? row.deal.stageId
        : "unassigned";
    byStage.get(key)!.push(row);
  }

  const columns: Array<{ key: number | "unassigned"; title: string; rows: DealRow[] }> =
    [
      ...stages.map((s) => ({
        key: s.stageId as number | "unassigned",
        title: s.name,
        rows: byStage.get(s.stageId) ?? [],
      })),
    ];

  const unassigned = byStage.get("unassigned") ?? [];
  if (unassigned.length > 0 || stages.length === 0) {
    columns.push({ key: "unassigned", title: "Unassigned", rows: unassigned });
  }

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No stages yet. Run a Pipedrive refresh to sync pipeline stages.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={String(col.key)}
          className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/20 p-2"
        >
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {col.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {col.rows.length.toLocaleString("de-DE")}
            </span>
          </div>
          <ul className="flex min-h-16 flex-col gap-2">
            {col.rows.map(({ deal, companyName }) => (
              <li key={deal.id}>
                <Link
                  href={`/customers/deals/${deal.id}`}
                  className="block rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">{deal.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {companyName ?? "No company"}
                    {deal.valueAmount != null
                      ? ` · ${Number(deal.valueAmount).toLocaleString("de-DE", {
                          maximumFractionDigits: 2,
                        })} ${deal.currency}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
