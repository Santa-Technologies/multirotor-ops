import { describe, expect, it } from "vitest";

/**
 * Pure cascade filter rules used by CRM pickers (mirrored from
 * CrmCascadePickers behaviour for regression coverage).
 */
function cascadeFilters(input: {
  dealCompanyId?: string | null;
  dealContactId?: string | null;
  selectedCompanyId?: string | null;
  selectedContactCompanyId?: string | null;
}) {
  if (input.dealCompanyId) {
    return {
      companyId: input.dealCompanyId,
      contactId: input.dealContactId ?? null,
      locked: true,
      contactsCompanyId: input.dealCompanyId,
      dealsCompanyId: input.dealCompanyId,
    };
  }
  const companyId =
    input.selectedCompanyId ?? input.selectedContactCompanyId ?? null;
  return {
    companyId,
    contactId: null,
    locked: false,
    contactsCompanyId: companyId,
    dealsCompanyId: companyId,
  };
}

describe("CRM cascade filters", () => {
  it("locks company and contact when a deal is selected", () => {
    expect(
      cascadeFilters({
        dealCompanyId: "co-1",
        dealContactId: "ct-1",
        selectedCompanyId: "other",
      }),
    ).toEqual({
      companyId: "co-1",
      contactId: "ct-1",
      locked: true,
      contactsCompanyId: "co-1",
      dealsCompanyId: "co-1",
    });
  });

  it("filters contacts and deals by company when company is selected", () => {
    expect(cascadeFilters({ selectedCompanyId: "co-2" })).toMatchObject({
      companyId: "co-2",
      locked: false,
      contactsCompanyId: "co-2",
      dealsCompanyId: "co-2",
    });
  });

  it("auto-sets company from contact parent", () => {
    expect(cascadeFilters({ selectedContactCompanyId: "co-3" })).toMatchObject({
      companyId: "co-3",
      contactsCompanyId: "co-3",
    });
  });
});
