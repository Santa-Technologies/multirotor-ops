"use client";

import { useState } from "react";

import { EntityPicker } from "@/components/entity-picker";
import type { EntityOption } from "@/lib/entities/types";

export type CrmCascadeValue = {
  dealId: string;
  companyId: string;
  contactId: string;
  pipedriveDealId: number | null;
};

/**
 * Cascading CRM picks: deal locks company/contact; company filters contacts
 * and deals; contact alone requires/auto-sets parent company.
 */
export function CrmCascadePickers({
  defaults,
  dealName = "deal_id",
  companyName = "company_id",
  contactName = "contact_id",
  pipedriveDealName = "pipedrive_deal_id",
  requireCompany = true,
  showDeal = true,
  showContact = true,
}: {
  defaults?: Partial<{
    dealId: string;
    dealLabel: string;
    companyId: string;
    companyLabel: string;
    contactId: string;
    contactLabel: string;
    pipedriveDealId: number;
  }>;
  dealName?: string;
  companyName?: string;
  contactName?: string;
  pipedriveDealName?: string;
  requireCompany?: boolean;
  showDeal?: boolean;
  showContact?: boolean;
}) {
  const [companyId, setCompanyId] = useState(defaults?.companyId ?? "");
  const [companyLabel, setCompanyLabel] = useState(defaults?.companyLabel ?? "");
  const [contactId, setContactId] = useState(defaults?.contactId ?? "");
  const [contactLabel, setContactLabel] = useState(defaults?.contactLabel ?? "");
  const [dealId, setDealId] = useState(defaults?.dealId ?? "");
  const [dealLabel, setDealLabel] = useState(defaults?.dealLabel ?? "");
  const [pipedriveId, setPipedriveId] = useState<number | null>(
    defaults?.pipedriveDealId ?? null,
  );
  const [dealLocked, setDealLocked] = useState(Boolean(defaults?.dealId));

  function onDeal(option: EntityOption | null) {
    if (!option) {
      setDealId("");
      setDealLabel("");
      setPipedriveId(null);
      setDealLocked(false);
      return;
    }
    setDealId(option.id);
    setDealLabel(option.label);
    setPipedriveId(option.meta?.pipedriveId ?? null);
    setDealLocked(true);
    if (option.meta?.companyId) {
      setCompanyId(option.meta.companyId);
      setCompanyLabel("(from deal)");
    }
    if (option.meta?.contactId) {
      setContactId(option.meta.contactId);
      setContactLabel("(from deal)");
    }
  }

  function onCompany(option: EntityOption | null) {
    if (dealLocked) return;
    setCompanyId(option?.id ?? "");
    setCompanyLabel(option?.label ?? "");
    // Changing company clears contact/deal that belonged to another org.
    setContactId("");
    setContactLabel("");
    setDealId("");
    setDealLabel("");
    setPipedriveId(null);
  }

  function onContact(option: EntityOption | null) {
    if (dealLocked) return;
    setContactId(option?.id ?? "");
    setContactLabel(option?.label ?? "");
    if (option?.meta?.companyId) {
      setCompanyId(option.meta.companyId);
      if (!companyLabel) setCompanyLabel("(from contact)");
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showDeal ? (
        <EntityPicker
          type="deals"
          name={dealName}
          label="Deal"
          value={dealId}
          initialLabel={dealLabel}
          companyId={companyId || undefined}
          onChange={onDeal}
        />
      ) : null}
      <EntityPicker
        type="companies"
        name={companyName}
        label="Company"
        required={requireCompany}
        disabled={dealLocked}
        value={companyId}
        initialLabel={companyLabel}
        onChange={onCompany}
      />
      {showContact ? (
        <EntityPicker
          type="contacts"
          name={contactName}
          label="Contact"
          disabled={dealLocked}
          value={contactId}
          initialLabel={contactLabel}
          companyId={companyId || undefined}
          onChange={onContact}
        />
      ) : null}
      <input
        type="hidden"
        name={pipedriveDealName}
        value={pipedriveId != null ? String(pipedriveId) : ""}
      />
    </div>
  );
}
