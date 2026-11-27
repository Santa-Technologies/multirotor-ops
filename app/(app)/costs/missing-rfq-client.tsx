"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MissingRfqItem } from "@/lib/costing/missing-rfq";

import {
  bulkSendMissingRfqAction,
  setDistributorRfqEmailAction,
  type MissingRfqActionState,
} from "./missing-rfq-actions";

const idle: MissingRfqActionState = { status: "idle" };

function Status({ state }: { state: MissingRfqActionState }) {
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

export function SetDistributorEmailForm({
  distributorId,
  distributorName,
}: {
  distributorId: string;
  distributorName: string;
}) {
  const [state, action, pending] = useActionState(setDistributorRfqEmailAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="distributor_id" value={distributorId} />
      <p className="text-sm text-muted-foreground">{distributorName}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`email-${distributorId}`}>RFQ email</Label>
        <Input
          id={`email-${distributorId}`}
          name="rfq_email"
          type="email"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`contact-${distributorId}`}>Contact name</Label>
        <Input id={`contact-${distributorId}`} name="rfq_contact_name" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save email"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function BulkRfqClient({ items }: { items: MissingRfqItem[] }) {
  const readyIds = items.filter((i) => i.ready).map((i) => i.partId!);
  const [selected, setSelected] = useState<Set<string>>(new Set(readyIds));
  const [state, action, pending] = useActionState(bulkSendMissingRfqAction, idle);

  function toggle(partId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }

  function selectAllReady() {
    setSelected(new Set(readyIds));
  }

  const selectedItems = items.filter(
    (i) => i.partId && i.distributorId && selected.has(i.partId),
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={selectAllReady}>
          Select all ready
        </Button>
        <div className="flex items-center gap-2">
          <Label htmlFor="bulk-qty" className="text-xs">
            Qty
          </Label>
          <Input
            id="bulk-qty"
            name="qty"
            type="number"
            min={1}
            defaultValue={100}
            className="h-8 w-24"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending || selectedItems.length === 0}>
          {pending ? "Sending…" : `Send ${selectedItems.length} RFQ(s)`}
        </Button>
      </div>
      <Status state={state} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium"> </th>
              <th className="px-3 py-2 font-medium">MPN</th>
              <th className="px-3 py-2 font-medium">Distributor</th>
              <th className="px-3 py-2 font-medium">RFQ email</th>
              <th className="px-3 py-2 font-medium">Thread</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const canSelect = Boolean(item.partId && item.rfqEmail && item.ready);
              return (
                <tr key={item.mpn}>
                  <td className="px-3 py-2">
                    {item.partId && item.distributorId ? (
                      <>
                        <input
                          type="checkbox"
                          checked={selected.has(item.partId)}
                          disabled={!canSelect}
                          onChange={() => toggle(item.partId!)}
                        />
                        {selected.has(item.partId) ? (
                          <>
                            <input type="hidden" name="part_id" value={item.partId} />
                            <input
                              type="hidden"
                              name="distributor_id"
                              value={item.distributorId}
                            />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{item.mpn}</td>
                  <td className="px-3 py-2">{item.distributorName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.rfqEmail ?? "set distributor email"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.threadStatus
                      ? item.threadStatus === "confirmed"
                        ? "known"
                        : item.threadStatus.replaceAll("_", " ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
