"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createCompanyAction,
  createContactAction,
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

type SelectOpt = { id: string; label: string; companyId?: string };

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompanyAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Add company</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="co-name">Name</Label>
          <Input id="co-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="co-country">Country</Label>
          <Input id="co-country" name="country" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="co-web">Website</Label>
          <Input id="co-web" name="website" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save company"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function CreateContactForm({ companies }: { companies: SelectOpt[] }) {
  const [state, action, pending] = useActionState(createContactAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Add contact</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-company">Company</Label>
          <select
            id="ct-company"
            name="company_id"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Select…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-name">Name</Label>
          <Input id="ct-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-email">Email</Label>
          <Input id="ct-email" name="email" type="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-phone">Phone</Label>
          <Input id="ct-phone" name="phone" />
        </div>
      </div>
      <Button type="submit" disabled={pending || companies.length === 0}>
        {pending ? "Saving…" : "Save contact"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function CreateRequestForm({
  companies,
  contacts,
  products,
  owners,
  deals,
}: {
  companies: SelectOpt[];
  contacts: SelectOpt[];
  products: SelectOpt[];
  owners: SelectOpt[];
  deals: SelectOpt[];
}) {
  const [state, action, pending] = useActionState(createRequestAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Log request</h3>
      <p className="text-xs text-muted-foreground">
        Pasted customer messages are stored as raw text only — no LLM processing.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-company">Company</Label>
          <select
            id="rq-company"
            name="company_id"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Select…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-contact">Contact (optional)</Label>
          <select
            id="rq-contact"
            name="contact_id"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-type">Type</Label>
          <select
            id="rq-type"
            name="type"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            defaultValue="quote"
          >
            <option value="quote">Quote</option>
            <option value="feature">Feature</option>
            <option value="custom_variant">Custom variant</option>
            <option value="integration_issue">Integration issue</option>
            <option value="bug">Bug</option>
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-product">Product</Label>
          <select
            id="rq-product"
            name="product_id"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
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
          <Label htmlFor="rq-owner">Owner</Label>
          <select
            id="rq-owner"
            name="owner_id"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rq-due">Due date</Label>
          <Input id="rq-due" name="due_date" type="date" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="rq-deal">Pipedrive deal (optional)</Label>
          <select
            id="rq-deal"
            name="pipedrive_deal_id"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
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
      <Button type="submit" disabled={pending || companies.length === 0}>
        {pending ? "Saving…" : "Save request"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function TriageRequestForm({
  request,
  owners,
  products,
  deals,
}: {
  request: {
    id: string;
    status: string;
    ownerId: string | null;
    dueDate: string | null;
    productId: string | null;
    urgency: string | null;
    pipedriveDealId: number | null;
  };
  owners: SelectOpt[];
  products: SelectOpt[];
  deals: SelectOpt[];
}) {
  const [state, action, pending] = useActionState(updateRequestAction, idle);
  return (
    <form action={action} className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="request_id" value={request.id} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select
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
        <select
          name="owner_id"
          defaultValue={request.ownerId ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Owner…</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          name="product_id"
          defaultValue={request.productId ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          name="urgency"
          defaultValue={request.urgency ?? "normal"}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <Input name="due_date" type="date" defaultValue={request.dueDate ?? ""} />
      </div>
      <select
        name="pipedrive_deal_id"
        defaultValue={
          request.pipedriveDealId != null ? String(request.pipedriveDealId) : ""
        }
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option value="">No Pipedrive deal</option>
        {deals.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </Button>
      <Status state={state} />
    </form>
  );
}
