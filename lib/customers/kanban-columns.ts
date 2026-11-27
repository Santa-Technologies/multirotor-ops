/**
 * Builds read-only kanban columns from Pipedrive stages and open deals.
 * Prefer synced stage rows for order/names; fall back to deal stage fields
 * when the stages table is empty or a deal's stage is missing from it.
 */
export function buildKanbanColumns<
  TRow extends {
    deal: {
      stageId: number | null;
      stageName: string | null;
    };
  },
  TStage extends {
    stageId: number;
    name: string;
    orderNr: number;
  },
>(stages: TStage[], deals: TRow[]) {
  type Column = { key: number | "unassigned"; title: string; rows: TRow[] };

  const byStage = new Map<number | "unassigned", TRow[]>();
  for (const stage of stages) byStage.set(stage.stageId, []);
  byStage.set("unassigned", []);

  const orphanStages = new Map<number, { name: string; rows: TRow[] }>();

  for (const row of deals) {
    const stageId = row.deal.stageId;
    if (stageId != null && byStage.has(stageId)) {
      byStage.get(stageId)!.push(row);
      continue;
    }
    if (stageId != null) {
      const existing = orphanStages.get(stageId);
      if (existing) {
        existing.rows.push(row);
      } else {
        orphanStages.set(stageId, {
          name: row.deal.stageName?.trim() || `Stage ${stageId}`,
          rows: [row],
        });
      }
      continue;
    }
    // No stage id — still group by stage name when Pipedrive left a label.
    const name = row.deal.stageName?.trim();
    if (name) {
      const syntheticKey = -Math.abs(hashString(name));
      const existing = orphanStages.get(syntheticKey);
      if (existing) {
        existing.rows.push(row);
      } else {
        orphanStages.set(syntheticKey, { name, rows: [row] });
      }
      continue;
    }
    byStage.get("unassigned")!.push(row);
  }

  const columns: Column[] = stages.map((s) => ({
    key: s.stageId,
    title: s.name,
    rows: byStage.get(s.stageId) ?? [],
  }));

  for (const [stageId, orphan] of orphanStages) {
    columns.push({ key: stageId, title: orphan.name, rows: orphan.rows });
  }

  const unassigned = byStage.get("unassigned") ?? [];
  if (unassigned.length > 0) {
    columns.push({ key: "unassigned", title: "Unassigned", rows: unassigned });
  }

  return columns;
}

/** Stable positive int hash for synthetic stage keys when only a name exists. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash === 0 ? 1 : Math.abs(hash);
}
