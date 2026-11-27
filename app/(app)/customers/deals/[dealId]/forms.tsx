"use client";

import { useActionState } from "react";
import Link from "next/link";

import { ActionDialog } from "@/components/action-dialog";
import { CreateRequestDialog } from "@/app/(app)/requests/forms";
import { EntityPicker } from "@/components/entity-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  attachDocumentAction,
  logInvoiceAction,
  logOrderAction,
  updateShipmentAction,
  type DealActionState,
} from "./actions";

const idle: DealActionState = { status: "idle" };

function Status({ state }: { state: DealActionState }) {
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

export function DealActionsBar({
  deal,
  company,
  contact,
  canRequest,
  canOrder,
}: {
  deal: {
    id: string;
    title: string;
    pipedriveId: number;
  };
  company: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  canRequest: boolean;
  canOrder: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canRequest && company ? (
        <CreateRequestDialog
          defaults={{
            dealId: deal.id,
            dealLabel: deal.title,
            companyId: company.id,
            companyLabel: company.name,
            contactId: contact?.id,
            contactLabel: contact?.name,
            pipedriveDealId: deal.pipedriveId,
          }}
        />
      ) : null}
      <Link
        href={`/quotes?deal=${deal.id}`}
        className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted"
      >
        Calculate quote
      </Link>
      {canOrder && company ? (
        <LogOrderDialog
          dealId={deal.id}
          companyId={company.id}
          companyLabel={company.name}
        />
      ) : null}
    </div>
  );
}

function LogOrderDialog({
  dealId,
  companyId,
  companyLabel,
}: {
  dealId: string;
  companyId: string;
  companyLabel: string;
}) {
  return (
    <ActionDialog triggerLabel="Log order" title="Log sales order">
      <LogOrderForm
        dealId={dealId}
        companyId={companyId}
        companyLabel={companyLabel}
      />
    </ActionDialog>
  );
}

function LogOrderForm({
  dealId,
  companyId,
  companyLabel,
}: {
  dealId: string;
  companyId: string;
  companyLabel: string;
}) {
  const [state, action, pending] = useActionState(logOrderAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="company_id" value={companyId} />
      <p className="text-xs text-muted-foreground">Company: {companyLabel}</p>
      <EntityPicker type="products" name="product_id" label="Product" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ord-qty">Qty</Label>
          <Input id="ord-qty" name="qty" type="number" min={1} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ord-status">Status</Label>
          <select
            id="ord-status"
            name="status"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            defaultValue="intent"
          >
            <option value="intent">Intent</option>
            <option value="quoted">Quoted</option>
            <option value="ordered">Ordered</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ord-notes">Notes</Label>
        <Input id="ord-notes" name="notes" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save order"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function OrderFollowUpForms({
  dealId,
  orderId,
  canInvoice,
  canShip,
}: {
  dealId: string;
  orderId: string;
  canInvoice: boolean;
  canShip: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canInvoice ? (
        <ActionDialog triggerLabel="Log invoice" title="Log invoice" triggerVariant="outline">
          <LogInvoiceForm dealId={dealId} orderId={orderId} />
        </ActionDialog>
      ) : null}
      {canShip ? (
        <ActionDialog
          triggerLabel="Shipment"
          title="Update shipment"
          triggerVariant="outline"
        >
          <ShipmentForm dealId={dealId} orderId={orderId} />
        </ActionDialog>
      ) : null}
      {canInvoice ? (
        <ActionDialog
          triggerLabel="Attach PDF"
          title="Attach external PDF"
          triggerVariant="outline"
        >
          <AttachDocForm dealId={dealId} orderId={orderId} />
        </ActionDialog>
      ) : null}
    </div>
  );
}

function LogInvoiceForm({ dealId, orderId }: { dealId: string; orderId: string }) {
  const [state, action, pending] = useActionState(logInvoiceAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-num">External number</Label>
          <Input id="inv-num" name="external_number" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-amt">Amount (€)</Label>
          <Input id="inv-amt" name="amount_euros" required placeholder="1.234,56" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-pdf">PDF URL</Label>
        <Input id="inv-pdf" name="pdf_url" placeholder="https://…" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mark_paid" value="1" />
        Mark as paid
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save invoice"}
      </Button>
      <Status state={state} />
    </form>
  );
}

function ShipmentForm({ dealId, orderId }: { dealId: string; orderId: string }) {
  const [state, action, pending] = useActionState(updateShipmentAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="order_id" value={orderId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ship-status">Status</Label>
        <select
          id="ship-status"
          name="status"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue="ready"
        >
          <option value="not_ready">Not ready</option>
          <option value="ready">Ready to send</option>
          <option value="shipped">Shipped</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ship-track">Tracking</Label>
          <Input id="ship-track" name="tracking" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ship-eta">ETA</Label>
          <Input id="ship-eta" name="eta" type="date" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ship-notes">Notes</Label>
        <Input id="ship-notes" name="notes" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save shipment"}
      </Button>
      <Status state={state} />
    </form>
  );
}

function AttachDocForm({ dealId, orderId }: { dealId: string; orderId: string }) {
  const [state, action, pending] = useActionState(attachDocumentAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="order_id" value={orderId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-kind">Kind</Label>
        <select
          id="doc-kind"
          name="kind"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue="invoice_pdf"
        >
          <option value="quote_pdf">Quote PDF</option>
          <option value="invoice_pdf">Invoice PDF</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-name">Filename</Label>
        <Input id="doc-name" name="filename" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-url">URL</Label>
        <Input id="doc-url" name="url" placeholder="https://…" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Attach"}
      </Button>
      <Status state={state} />
    </form>
  );
}
