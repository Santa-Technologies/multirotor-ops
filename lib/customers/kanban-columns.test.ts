import { describe, expect, it } from "vitest";

import { buildKanbanColumns } from "./kanban-columns";

describe("buildKanbanColumns", () => {
  it("places deals under matching Pipedrive stages in order", () => {
    const stages = [
      { stageId: 10, name: "Qualified", orderNr: 1 },
      { stageId: 20, name: "Proposal", orderNr: 2 },
    ];
    const deals = [
      { deal: { stageId: 20, stageName: "Proposal" } },
      { deal: { stageId: 10, stageName: "Qualified" } },
    ];

    const columns = buildKanbanColumns(stages, deals);
    expect(columns.map((c) => c.title)).toEqual(["Qualified", "Proposal"]);
    expect(columns[0]!.rows).toHaveLength(1);
    expect(columns[1]!.rows).toHaveLength(1);
  });

  it("synthesises columns from deal stage fields when stages are empty", () => {
    const columns = buildKanbanColumns(
      [],
      [
        { deal: { stageId: 5, stageName: "Negotiation" } },
        { deal: { stageId: 5, stageName: "Negotiation" } },
        { deal: { stageId: 7, stageName: "Won pending" } },
      ],
    );
    expect(columns.map((c) => c.title)).toEqual(["Negotiation", "Won pending"]);
    expect(columns[0]!.rows).toHaveLength(2);
    expect(columns.some((c) => c.title === "Unassigned")).toBe(false);
  });

  it("only uses Unassigned when stage id and name are both missing", () => {
    const columns = buildKanbanColumns(
      [{ stageId: 1, name: "Lead In", orderNr: 0 }],
      [
        { deal: { stageId: 1, stageName: "Lead In" } },
        { deal: { stageId: null, stageName: null } },
      ],
    );
    expect(columns.map((c) => c.title)).toEqual(["Lead In", "Unassigned"]);
    expect(columns[1]!.rows).toHaveLength(1);
  });
});
