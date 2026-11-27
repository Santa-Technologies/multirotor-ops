"use client";

import { useActionState } from "react";

import { ActionDialog } from "@/components/action-dialog";
import { EntityPicker } from "@/components/entity-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createAssemblyLotAction,
  updateAssemblyLotAction,
  upsertFinishedGoodsAction,
  upsertPartInventoryAction,
  type InventoryActionState,
} from "./actions";

const initial: InventoryActionState = { status: "idle" };

function Status({ state }: { state: InventoryActionState }) {
  if (state.status === "error") {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }
  if (state.status === "ok") {
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  }
  return null;
}

export function PartStockDialog() {
  return (
    <ActionDialog triggerLabel="Update stock" title="Update part stock" triggerVariant="outline">
      <PartStockForm />
    </ActionDialog>
  );
}

function PartStockForm() {
  const [state, action, pending] = useActionState(upsertPartInventoryAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <EntityPicker type="parts" name="part_id" label="Part" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pi-hand">On hand</Label>
        <Input id="pi-hand" name="on_hand" type="number" min={0} defaultValue={0} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pi-order">On order</Label>
        <Input id="pi-order" name="on_order_qty" type="number" min={0} defaultValue={0} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pi-eta">ETA</Label>
        <Input id="pi-eta" name="eta" type="date" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pi-po">PO ref</Label>
        <Input id="pi-po" name="po_ref" placeholder="Optional" />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="pi-notes">Notes</Label>
        <Input id="pi-notes" name="notes" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save part stock"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function FinishedGoodsDialog() {
  return (
    <ActionDialog
      triggerLabel="FG"
      title="Update finished goods"
      triggerVariant="outline"
    >
      <FinishedGoodsForm />
    </ActionDialog>
  );
}

function FinishedGoodsForm() {
  const [state, action, pending] = useActionState(upsertFinishedGoodsAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <EntityPicker type="products" name="product_id" label="Product" required />
      <div className="grid gap-1.5">
        <Label htmlFor="fg-qty">On hand</Label>
        <Input id="fg-qty" name="qty" type="number" min={0} defaultValue={0} required />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="fg-notes">Notes</Label>
        <Input id="fg-notes" name="notes" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save finished goods"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CreateLotDialog() {
  return (
    <ActionDialog triggerLabel="New lot" title="Add assembly lot">
      <CreateLotForm />
    </ActionDialog>
  );
}

function CreateLotForm() {
  const [state, action, pending] = useActionState(createAssemblyLotAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <EntityPicker type="products" name="product_id" label="Product" required />
      <div className="grid gap-1.5">
        <Label htmlFor="lot-qty">Quantity</Label>
        <Input id="lot-qty" name="qty" type="number" min={1} defaultValue={100} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lot-status">Status</Label>
        <select
          id="lot-status"
          name="status"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue="planned"
        >
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lot-eta">ETA</Label>
        <Input id="lot-eta" name="eta" type="date" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lot-assembler">Assembler</Label>
        <Input id="lot-assembler" name="assembler" placeholder="Optional" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lot-notes">Notes</Label>
        <Input id="lot-notes" name="notes" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add assembly lot"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Inline status/ETA update for one open lot. */
export function UpdateLotForm({
  lot,
}: {
  lot: {
    id: string;
    status: string;
    eta: string | null;
    assembler: string | null;
    notes: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateAssemblyLotAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="lot_id" value={lot.id} />
      <div className="grid gap-1">
        <Label htmlFor={`lot-status-${lot.id}`} className="text-xs">
          Status
        </Label>
        <select
          id={`lot-status-${lot.id}`}
          name="status"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue={lot.status}
        >
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`lot-eta-${lot.id}`} className="text-xs">
          ETA
        </Label>
        <Input
          id={`lot-eta-${lot.id}`}
          name="eta"
          type="date"
          className="h-8"
          defaultValue={lot.eta ?? ""}
        />
      </div>
      <input type="hidden" name="assembler" value={lot.assembler ?? ""} />
      <input type="hidden" name="notes" value={lot.notes ?? ""} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Update"}
      </Button>
      <Status state={state} />
    </form>
  );
}
