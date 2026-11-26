"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  addAssemblyPriceAction,
  addManualQuoteAction,
  runCostAction,
  type CostActionState,
} from "./actions";

const initial: CostActionState = { status: "idle" };

function Status({ state }: { state: CostActionState }) {
  if (state.status === "error") {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }
  if (state.status === "ok") {
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  }
  return null;
}

/** Triggers a cost run for the selected cost-plus product. */
export function RunCostForm({
  products,
}: {
  products: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(runCostAction, initial);
  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">No cost-plus products yet.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="run-product">Product</Label>
        <select
          id="run-product"
          name="product_id"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue={products[0]!.id}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Running…" : "Run cost now"}
      </Button>
      <Status state={state} />
    </form>
  );
}

/** Quick form for supply to log a part quote. */
export function ManualQuoteForm() {
  const [state, action, pending] = useActionState(addManualQuoteAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="mq-mpn">MPN</Label>
        <Input id="mq-mpn" name="mpn" required placeholder="STM32H743VIT6" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mq-supplier">Supplier</Label>
        <Input id="mq-supplier" name="supplier" required placeholder="Distributor GmbH" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mq-qty">Qty break</Label>
        <Input id="mq-qty" name="qty" type="number" min={1} required defaultValue={1000} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mq-price">Unit price (€)</Label>
        <Input id="mq-price" name="unit_price_euros" required placeholder="12,50" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mq-quoted">Quoted on</Label>
        <Input id="mq-quoted" name="quoted_at" type="date" defaultValue={today} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mq-valid">Valid until</Label>
        <Input id="mq-valid" name="valid_until" type="date" />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="mq-note">Note</Label>
        <Input id="mq-note" name="note" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save supplier quote"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Quick form for supply to log assembly pricing. */
export function AssemblyPriceForm({
  products,
}: {
  products: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(addAssemblyPriceAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  if (products.length === 0) return null;
  return (
    <form action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="ap-product">Product</Label>
        <select
          id="ap-product"
          name="product_id"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue={products[0]!.id}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-assembler">Assembler</Label>
        <Input id="ap-assembler" name="assembler" required placeholder="EMS Partner" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-tier">Qty tier</Label>
        <Input id="ap-tier" name="qty_tier" type="number" min={1} required defaultValue={1000} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-unit">Unit price (€)</Label>
        <Input id="ap-unit" name="unit_price_euros" required placeholder="5,00" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-setup">Setup (€)</Label>
        <Input id="ap-setup" name="setup_euros" placeholder="0" defaultValue="0" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-quoted">Quoted on</Label>
        <Input id="ap-quoted" name="quoted_at" type="date" defaultValue={today} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ap-valid">Valid until</Label>
        <Input id="ap-valid" name="valid_until" type="date" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save assembly price"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}
