"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { syncPipedriveAction, type CustomerActionState } from "./actions";

const idle: CustomerActionState = { status: "idle" };

export function SyncPipedriveForm() {
  const [state, action, pending] = useActionState(syncPipedriveAction, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Syncing…" : "Refresh from Pipedrive"}
      </Button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          One-way import only. Deal stages are not written back.
        </p>
      )}
    </form>
  );
}
