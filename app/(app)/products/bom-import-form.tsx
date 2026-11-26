"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { importBomAction, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

/** CSV BOM upload for one variant; column mapping overrides are optional. */
export function BomImportForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(importBomAction, initial);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-3">
      <input type="hidden" name="product_id" value={productId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="bom-version">BOM version</Label>
          <Input id="bom-version" name="version" required placeholder="2026-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bom-file">CSV file</Label>
          <Input id="bom-file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="bom-notes">Notes</Label>
          <Input id="bom-notes" name="notes" placeholder="Optional" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Headers are detected automatically (MPN, Qty, Manufacturer, Designators, …). Save
        Excel sheets as CSV first. Shared MPNs reuse the global parts catalog.
      </p>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      {state.issues && state.issues.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {state.issues.slice(0, 8).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Importing…" : "Import BOM"}
      </Button>
    </form>
  );
}
