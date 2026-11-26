"use client";

import { useActionState } from "react";

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

/** Upsert form for part on-hand / on-order stock. */
export function PartStockForm({
  parts,
}: {
  parts: Array<{ id: string; mpn: string }>;
}) {
  const [state, action, pending] = useActionState(upsertPartInventoryAction, initial);
  return (
    <form action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="pi-part">Part</Label>
        <select
          id="pi-part"
          name="part_id"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue={parts[0]?.id}
          required={parts.length > 0}
        >
          {parts.length === 0 ? (
            <option value="">No parts yet — import a BOM</option>
          ) : (
            parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.mpn}
              </option>
            ))
          )}
        </select>
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
        <Button type="submit" disabled={pending || parts.length === 0}>
          {pending ? "Saving…" : "Save part stock"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Upsert finished-goods qty for a variant. */
export function FinishedGoodsForm({
  products,
}: {
  products: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(upsertFinishedGoodsAction, initial);
  return (
    <form action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="fg-product">Product</Label>
        <select
          id="fg-product"
          name="product_id"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue={products[0]?.id}
          required
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fg-qty">On hand</Label>
        <Input id="fg-qty" name="qty" type="number" min={0} defaultValue={0} required />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="fg-notes">Notes</Label>
        <Input id="fg-notes" name="notes" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending || products.length === 0}>
          {pending ? "Saving…" : "Save finished goods"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Create a new assembly / WIP lot. */
export function CreateLotForm({
  products,
}: {
  products: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createAssemblyLotAction, initial);
  return (
    <form action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="lot-product">Product</Label>
        <select
          id="lot-product"
          name="product_id"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue={products[0]?.id}
          required
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
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
        <Button type="submit" disabled={pending || products.length === 0}>
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
