"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { CrmCascadePickers } from "@/components/crm-cascade-pickers";
import { Button } from "@/components/ui/button";

import {
  approveQuoteAction,
  markSentAction,
  reviseQuoteAction,
  type QuoteLifecycleState,
} from "./actions";

const idle: QuoteLifecycleState = { status: "idle" };

function Status({ state }: { state: QuoteLifecycleState }) {
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

export function ApproveForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(approveQuoteAction, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="quote_id" value={quoteId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Approving…" : "Approve quote"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function MarkSentForm({
  quoteId,
  defaultCompanyId,
  defaultCompanyLabel,
  defaultDealId,
  defaultDealLabel,
  defaultDealUuid,
}: {
  quoteId: string;
  defaultCompanyId: string | null;
  defaultCompanyLabel?: string | null;
  defaultDealId: number | null;
  defaultDealLabel?: string | null;
  defaultDealUuid?: string | null;
}) {
  const [state, action, pending] = useActionState(markSentAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Mark as sent</h3>
      <p className="text-xs text-muted-foreground">
        Locks this version. Download the PDF for the customer. Optionally post a note
        on the linked Pipedrive deal (stage is not changed).
      </p>
      <input type="hidden" name="quote_id" value={quoteId} />
      <CrmCascadePickers
        defaults={{
          companyId: defaultCompanyId ?? undefined,
          companyLabel: defaultCompanyLabel ?? undefined,
          dealId: defaultDealUuid ?? undefined,
          dealLabel:
            defaultDealLabel ??
            (defaultDealId != null ? `PD #${defaultDealId}` : undefined),
          pipedriveDealId: defaultDealId ?? undefined,
        }}
        requireCompany
        showContact={false}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="post_pipedrive_note" value="1" defaultChecked />
        Post quote summary as Pipedrive deal note
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Mark sent"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ReviseForm({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(reviseQuoteAction, idle);

  useEffect(() => {
    if (state.status === "ok" && state.newQuoteId) {
      router.push(`/quotes/${state.newQuoteId}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="quote_id" value={quoteId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Creating…" : "Revise (new draft version)"}
      </Button>
      <Status state={state} />
    </form>
  );
}
