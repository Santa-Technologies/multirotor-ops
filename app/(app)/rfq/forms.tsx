"use client";

import { useActionState } from "react";

import { ActionDialog } from "@/components/action-dialog";
import { EntityPicker } from "@/components/entity-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuroCents } from "@/lib/format/money";

import {
  confirmOfferAction,
  createDistributorAction,
  createSupplierAction,
  rejectOfferAction,
  sendRfqAction,
  updateDistributorAction,
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

export type DistributorFormValues = {
  id: string;
  name: string;
  rfqEmail: string | null;
  rfqContactName: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  approved: boolean;
  hostKey: string | null;
};

export function CreateDistributorDialog() {
  return (
    <ActionDialog
      triggerLabel="Add distributor"
      title="Add distributor"
      description="Directory row for pricing APIs and RFQ mailbox / address."
      triggerVariant="outline"
    >
      <DistributorForm />
    </ActionDialog>
  );
}

export function EditDistributorDialog({
  distributor,
}: {
  distributor: DistributorFormValues;
}) {
  return (
    <ActionDialog
      triggerLabel="Edit"
      title={`Edit ${distributor.name}`}
      description="RFQ email, contact name, and postal address."
      triggerVariant="outline"
    >
      <DistributorForm distributor={distributor} />
    </ActionDialog>
  );
}

function DistributorForm({
  distributor,
}: {
  distributor?: DistributorFormValues;
}) {
  const actionFn = distributor ? updateDistributorAction : createDistributorAction;
  const [state, action, pending] = useActionState(actionFn, idle);
  const idPrefix = distributor?.id ?? "new";

  return (
    <form action={action} className="flex flex-col gap-3">
      {distributor ? (
        <input type="hidden" name="distributor_id" value={distributor.id} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-name-${idPrefix}`}>Name</Label>
          <Input
            id={`dist-name-${idPrefix}`}
            name="name"
            required
            defaultValue={distributor?.name ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-email-${idPrefix}`}>RFQ email</Label>
          <Input
            id={`dist-email-${idPrefix}`}
            name="rfq_email"
            type="email"
            defaultValue={distributor?.rfqEmail ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-contact-${idPrefix}`}>Contact name</Label>
          <Input
            id={`dist-contact-${idPrefix}`}
            name="rfq_contact_name"
            defaultValue={distributor?.rfqContactName ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-host-${idPrefix}`}>Host key</Label>
          <Input
            id={`dist-host-${idPrefix}`}
            name="host_key"
            placeholder="digikey.de"
            defaultValue={distributor?.hostKey ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`dist-address-${idPrefix}`}>Address</Label>
          <Input
            id={`dist-address-${idPrefix}`}
            name="address_line"
            defaultValue={distributor?.addressLine ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-city-${idPrefix}`}>City</Label>
          <Input
            id={`dist-city-${idPrefix}`}
            name="city"
            defaultValue={distributor?.city ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-postal-${idPrefix}`}>Postal code</Label>
          <Input
            id={`dist-postal-${idPrefix}`}
            name="postal_code"
            defaultValue={distributor?.postalCode ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dist-country-${idPrefix}`}>Country</Label>
          <Input
            id={`dist-country-${idPrefix}`}
            name="country"
            placeholder="DE"
            defaultValue={distributor?.country ?? ""}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id={`dist-approved-${idPrefix}`}
            name="approved"
            type="checkbox"
            value="true"
            defaultChecked={distributor?.approved ?? false}
            className="size-4 rounded border"
          />
          <Label htmlFor={`dist-approved-${idPrefix}`}>Approved (China-free)</Label>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : distributor ? "Save changes" : "Save distributor"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function CreateSupplierDialog() {
  return (
    <ActionDialog
      triggerLabel="Add supplier email"
      title="Add supplier"
      description="Email target for outbound RFQs (separate from the distributor directory)."
      triggerVariant="outline"
    >
      <CreateSupplierForm />
    </ActionDialog>
  );
}

function CreateSupplierForm() {
  const [state, action, pending] = useActionState(createSupplierAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
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

export function SendRfqDialog() {
  return (
    <ActionDialog
      triggerLabel="Send RFQ"
      title="Send RFQ"
      description="One open email per part. A second send for the same part is blocked until the open thread is confirmed or closed."
    >
      <SendRfqForm />
    </ActionDialog>
  );
}

function SendRfqForm() {
  const [state, action, pending] = useActionState(sendRfqAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <EntityPicker type="parts" name="part_id" label="Part" required />
      <EntityPicker type="suppliers" name="supplier_id" label="Supplier" required />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfq-qty">Qty</Label>
        <Input id="rfq-qty" name="qty" type="number" min={1} defaultValue={100} required />
      </div>
      <Button type="submit" disabled={pending}>
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
