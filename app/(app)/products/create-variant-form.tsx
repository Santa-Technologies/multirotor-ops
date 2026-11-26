"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createVariant, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

/** Form to add a variant under a product line. */
export function CreateVariantForm({
  lines,
}: {
  lines: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createVariant, initial);

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a product line before creating a variant.
      </p>
    );
  }

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="variant-line">Product line</Label>
          <select
            id="variant-line"
            name="product_line_id"
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            defaultValue={lines[0]!.id}
          >
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variant-label">Variant label</Label>
          <Input id="variant-label" name="variant_label" placeholder="Standard" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variant-name">Display name</Label>
          <Input
            id="variant-name"
            name="name"
            required
            placeholder="Pilot H743 Alt IMU"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variant-mode">Pricing mode</Label>
          <select
            id="variant-mode"
            name="pricing_mode"
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            defaultValue="cost_plus"
          >
            <option value="cost_plus">Cost plus</option>
            <option value="list_price">List price</option>
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="variant-sku">SKU</Label>
          <Input id="variant-sku" name="sku" placeholder="Optional" />
        </div>
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Add variant"}
      </Button>
    </form>
  );
}
