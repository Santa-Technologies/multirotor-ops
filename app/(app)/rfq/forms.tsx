"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuroCents } from "@/lib/format/money";

import {
  confirmOfferAction,
  createSupplierAction,
  rejectOfferAction,
  sendRfqAction,
  type RfqActionState,
} from "./actions";

const idle: RfqActionState = { status: "idle" };

function Status({ state }: { state: RfqActionState }) {
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

export function CreateSupplierForm() {
  const [state, action, pending] = useActionState(createSupplierAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Add supplier</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-name">Name</Label>
          <Input id="supplier-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-email">Email</Label>
          <Input id="supplier-email" name="email" type="email" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-notes">Notes</Label>
        <Input id="supplier-notes" name="notes" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save supplier"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function SendRfqForm({
  parts,
  suppliers,
}: {
  parts: Array<{ id: string; mpn: string }>;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(sendRfqAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Send RFQ</h3>
      <p className="text-xs text-muted-foreground">
        One open email per part. A second send for the same part is blocked until the
        open thread is confirmed or closed.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfq-part">Part</Label>
          <select
            id="rfq-part"
            name="part_id"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Select…</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.mpn}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfq-supplier">Supplier</Label>
          <select
            id="rfq-supplier"
            name="supplier_id"
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Select…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfq-qty">Qty</Label>
          <Input id="rfq-qty" name="qty" type="number" min={1} defaultValue={100} required />
        </div>
      </div>
      <Button type="submit" disabled={pending || parts.length === 0 || suppliers.length === 0}>
        {pending ? "Sending…" : "Send RFQ email"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ConfirmOfferForm({
  offer,
}: {
  offer: {
    id: string;
    qty: number | null;
    unitPriceCents: number | null;
    validUntil: string | null;
    stock: number | null;
    currency: string;
    parseNotes: string | null;
  };
}) {
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmOfferAction,
    idle,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(rejectOfferAction, idle);
  const defaultEuros =
    offer.unitPriceCents != null
      ? (offer.unitPriceCents / 100).toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })
      : "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      {offer.parseNotes ? (
        <p className="text-xs text-muted-foreground">Parse note: {offer.parseNotes}</p>
      ) : null}
      {offer.currency !== "EUR" ? (
        <p className="text-xs text-amber-700">
          Parsed currency was {offer.currency}. Enter the EUR unit price before confirming.
        </p>
      ) : null}
      <form action={confirmAction} className="grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="offer_id" value={offer.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${offer.id}`}>Qty</Label>
          <Input
            id={`qty-${offer.id}`}
            name="qty"
            type="number"
            min={1}
            defaultValue={offer.qty ?? 1}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`price-${offer.id}`}>Unit € (EUR)</Label>
          <Input
            id={`price-${offer.id}`}
            name="unit_price_euros"
            defaultValue={defaultEuros}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`valid-${offer.id}`}>Valid until</Label>
          <Input
            id={`valid-${offer.id}`}
            name="valid_until"
            type="date"
            defaultValue={offer.validUntil ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`stock-${offer.id}`}>Stock</Label>
          <Input
            id={`stock-${offer.id}`}
            name="stock"
            type="number"
            min={0}
            defaultValue={offer.stock ?? ""}
          />
        </div>
        <div className="sm:col-span-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={confirming}>
            {confirming ? "Saving…" : "Confirm → save quote"}
          </Button>
          {offer.unitPriceCents != null ? (
            <span className="self-center text-xs text-muted-foreground">
              Parsed: {formatEuroCents(offer.unitPriceCents)}
            </span>
          ) : null}
        </div>
      </form>
      <Status state={confirmState} />
      <form action={rejectAction}>
        <input type="hidden" name="offer_id" value={offer.id} />
        <Button type="submit" variant="outline" disabled={rejecting}>
          {rejecting ? "Rejecting…" : "Reject"}
        </Button>
      </form>
      <Status state={rejectState} />
    </div>
  );
}
