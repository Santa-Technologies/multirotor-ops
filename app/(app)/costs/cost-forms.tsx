"use client";

import { useActionState } from "react";

import { ActionDialog } from "@/components/action-dialog";
import { EntityPicker } from "@/components/entity-picker";
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

export function RunCostDialog() {
  return (
    <ActionDialog triggerLabel="Run cost" title="Run cost now">
      <RunCostForm />
    </ActionDialog>
  );
}

function RunCostForm() {
  const [state, action, pending] = useActionState(runCostAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <EntityPicker type="products" name="product_id" label="Product" required />
      <p className="text-xs text-muted-foreground">
        Cost-plus products only. List-price variants are ignored by the runner.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Running…" : "Run cost now"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ManualQuoteDialog() {
  return (
    <ActionDialog
      triggerLabel="Add supplier quote"
      title="Add supplier quote"
      triggerVariant="outline"
    >
      <ManualQuoteForm />
    </ActionDialog>
  );
}

function ManualQuoteForm() {
  const [state, action, pending] = useActionState(addManualQuoteAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
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

export function AssemblyPriceDialog() {
  return (
    <ActionDialog
      triggerLabel="Add assembly quote"
      title="Add assembly price"
      triggerVariant="outline"
    >
      <AssemblyPriceForm />
    </ActionDialog>
  );
}

function AssemblyPriceForm() {
  const [state, action, pending] = useActionState(addAssemblyPriceAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <EntityPicker type="products" name="product_id" label="Product" required />
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
