"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createProductLine, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

/** Form to add a product line (Pilot H743, CoPilot Nano, …). */
export function CreateLineForm() {
  const [state, action, pending] = useActionState(createProductLine, initial);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="line-name">Product line</Label>
          <Input id="line-name" name="name" required placeholder="CoPilot Micro" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="line-description">Description</Label>
          <Input id="line-description" name="description" placeholder="Optional" />
        </div>
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Add product line"}
      </Button>
    </form>
  );
}
