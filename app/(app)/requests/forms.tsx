"use client";

import { useActionState, useState } from "react";

import { ActionDialog } from "@/components/action-dialog";
import { CrmCascadePickers } from "@/components/crm-cascade-pickers";
import { EntityPicker } from "@/components/entity-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createRequestAction,
  updateRequestAction,
  type RequestActionState,
} from "./actions";

const idle: RequestActionState = { status: "idle" };

function Status({ state }: { state: RequestActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      className={
        state.status === "error"
          ? "text-sm text-destructive"
          : "text-sm text-muted-foreground"
      }
    >
      {state.message}
    </p>
  );
}

type RequestDefaults = {
  dealId?: string;
  dealLabel?: string;
  companyId?: string;
  companyLabel?: string;
  contactId?: string;
  contactLabel?: string;
  pipedriveDealId?: number;
};

export function CreateRequestDialog({ defaults }: { defaults?: RequestDefaults }) {
  return (
    <ActionDialog
      triggerLabel="Log request"
      title="Log request"
      description="For product variation / tech work. Pasted customer messages are stored as raw text only — no LLM processing. Companies and contacts come from Pipedrive sync."
    >
      <CreateRequestForm defaults={defaults} />
    </ActionDialog>
  );
}

function CreateRequestForm({ defaults }: { defaults?: RequestDefaults }) {
  const [state, action, pending] = useActionState(createRequestAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <CrmCascadePickers
        defaults={defaults}
        requireCompany
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-type">Type</Label>
          <select
            id="rq-type"
            name="type"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            defaultValue="custom_variant"
          >
            <option value="feature">Feature</option>
            <option value="custom_variant">Custom variant</option>
            <option value="integration_issue">Integration issue</option>
            <option value="bug">Bug</option>
            <option value="quote">Quote</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-channel">Source</Label>
          <select
            id="rq-channel"
            name="source_channel"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            <option value="linkedin">LinkedIn</option>
            <option value="signal">Signal</option>
            <option value="email">Email</option>
            <option value="trade_fair">Trade fair</option>
          </select>
        </div>
        <EntityPicker type="products" name="product_id" label="Product" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-qty">Quantity</Label>
          <Input id="rq-qty" name="quantity" type="number" min={1} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-urgency">Urgency</Label>
          <select
            id="rq-urgency"
            name="urgency"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            defaultValue="normal"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-due">Due date</Label>
          <Input id="rq-due" name="due_date" type="date" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rq-summary">Summary</Label>
        <Input id="rq-summary" name="summary" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rq-raw">Raw message (optional)</Label>
        <textarea
          id="rq-raw"
          name="raw_text"
          rows={4}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save request"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function TriageRequestDialog({
  request,
}: {
  request: {
    id: string;
    status: string;
    ownerId: string | null;
    dueDate: string | null;
    productId: string | null;
    productLabel?: string | null;
    urgency: string | null;
    dealId: string | null;
    dealLabel?: string | null;
    pipedriveDealId: number | null;
  };
}) {
  const [openLabel] = useState("Triage");
  return (
    <ActionDialog
      triggerLabel={openLabel}
      title="Triage request"
      triggerVariant="outline"
    >
      <TriageRequestForm request={request} />
    </ActionDialog>
  );
}

function TriageRequestForm({
  request,
}: {
  request: {
    id: string;
    status: string;
    ownerId: string | null;
    dueDate: string | null;
    productId: string | null;
    productLabel?: string | null;
    urgency: string | null;
    dealId: string | null;
    dealLabel?: string | null;
    pipedriveDealId: number | null;
  };
}) {
  const [state, action, pending] = useActionState(updateRequestAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="request_id" value={request.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`status-${request.id}`}>Status</Label>
          <select
            id={`status-${request.id}`}
            name="status"
            defaultValue={request.status}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="accepted">Accepted</option>
            <option value="planned">Planned</option>
            <option value="declined">Declined</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`urgency-${request.id}`}>Urgency</Label>
          <select
            id={`urgency-${request.id}`}
            name="urgency"
            defaultValue={request.urgency ?? "normal"}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <EntityPicker
          type="products"
          name="product_id"
          label="Product"
          value={request.productId ?? ""}
          initialLabel={request.productLabel ?? undefined}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`due-${request.id}`}>Due date</Label>
          <Input
            id={`due-${request.id}`}
            name="due_date"
            type="date"
            defaultValue={request.dueDate ?? ""}
          />
        </div>
      </div>
      <CrmCascadePickers
        defaults={{
          dealId: request.dealId ?? undefined,
          dealLabel: request.dealLabel ?? undefined,
        }}
        requireCompany={false}
        showContact={false}
      />
      <input type="hidden" name="owner_id" value={request.ownerId ?? ""} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </Button>
      <Status state={state} />
    </form>
  );
}
