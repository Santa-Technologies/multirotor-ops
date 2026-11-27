"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
  companies,
  deals,
  defaultCompanyId,
  defaultDealId,
}: {
  quoteId: string;
  companies: Array<{ id: string; label: string }>;
  deals: Array<{ id: string; label: string }>;
  defaultCompanyId: string | null;
  defaultDealId: number | null;
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sent-company">Company</Label>
        <select
          id="sent-company"
          name="company_id"
          required
          defaultValue={defaultCompanyId ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Select…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sent-deal">Pipedrive deal (optional)</Label>
        <select
          id="sent-deal"
          name="pipedrive_deal_id"
          defaultValue={defaultDealId != null ? String(defaultDealId) : ""}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">—</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="post_pipedrive_note" value="1" defaultChecked />
        Post quote summary as Pipedrive deal note
      </label>
      <Button type="submit" disabled={pending || companies.length === 0}>
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
