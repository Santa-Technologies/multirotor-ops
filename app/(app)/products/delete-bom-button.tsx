"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { deleteBomAction, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

/** Confirmed delete of one BOM version so the same CSV can be re-imported. */
export function DeleteBomButton({
  bomVersionId,
  versionLabel,
  deletable,
}: {
  bomVersionId: string;
  versionLabel: string;
  deletable: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteBomAction, initial);

  if (!deletable) {
    return (
      <p className="text-xs text-muted-foreground">
        Version {versionLabel} has cost runs — import a new version instead of
        deleting.
      </p>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => setConfirming(true)}
        >
          Delete BOM
        </Button>
        {state.status === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}
        {state.status === "ok" ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex max-w-xl flex-col gap-2 rounded-lg border border-destructive/40 p-3">
      <input type="hidden" name="bom_version_id" value={bomVersionId} />
      <p className="text-sm">
        Delete BOM version <span className="font-medium">{versionLabel}</span>?
        Lines for this product are removed. Shared parts used by other BOMs stay.
        You can upload the same CSV again afterwards.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
