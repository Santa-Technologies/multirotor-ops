"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuroCents, formatPct } from "@/lib/format/money";
import {
  calculateQuote,
  quoteText,
  type CostRunInput,
  type PricingSettings,
  type QuoteResult,
} from "@/lib/pricing";

import { saveDraftScenario, type SaveDraftState } from "./actions";

/** Cost run payload safe to pass from Server to Client Components. */
export type SerializedCostRun = Omit<CostRunInput, "runAt"> & { runAt: string };

export type PlaygroundProduct = {
  id: string;
  name: string;
  settings: PricingSettings;
  costRunId: string | null;
  costRun: SerializedCostRun | null;
};

function toCostRunInput(run: SerializedCostRun | null): CostRunInput | undefined {
  if (!run) return undefined;
  return { ...run, runAt: new Date(run.runAt) };
}

/** Live indicative pricing playground; drafts are internal only. */
export function PricingPlayground({ products }: { products: PlaygroundProduct[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId) ?? products[0];

  const [quantity, setQuantity] = useState(20_000);
  const [depositPct, setDepositPct] = useState(product?.settings.stdDepositPct ?? 50);
  const [paymentDays, setPaymentDays] = useState(0);
  const [marginPct, setMarginPct] = useState(product?.settings.marginPct ?? 30);
  const [saveState, setSaveState] = useState<SaveDraftState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const result: QuoteResult | { error: string } | null = useMemo(() => {
    if (!product) return null;
    try {
      return calculateQuote(
        {
          quantity,
          depositPct,
          paymentDays,
          marginPct,
          costRun: toCostRunInput(product.costRun),
          asOf: new Date(),
        },
        product.settings,
      );
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Invalid inputs.",
      };
    }
  }, [product, quantity, depositPct, paymentDays, marginPct]);

  if (!product) {
    return (
      <p className="text-sm text-muted-foreground">
        No cost-plus product with quote settings. Seed Pilot H743 first.
      </p>
    );
  }

  const ok = result && !("error" in result) ? result : null;
  const err = result && "error" in result ? result.error : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Internal indicative playground — not a customer quote. Accounting quotes and
          invoices stay outside this tool until buy intent is clear.
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor="pg-product">Product</Label>
          <select
            id="pg-product"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            value={product.id}
            onChange={(e) => {
              const next = products.find((p) => p.id === e.target.value);
              setProductId(e.target.value);
              if (next) {
                setDepositPct(next.settings.stdDepositPct);
                setMarginPct(next.settings.marginPct);
              }
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.costRun ? "" : " (estimated cost)"}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pg-qty">Quantity</Label>
            <Input
              id="pg-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-margin">Margin %</Label>
            <Input
              id="pg-margin"
              type="number"
              min={0}
              max={99}
              step={0.1}
              value={marginPct}
              onChange={(e) => setMarginPct(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-deposit">Deposit %</Label>
            <Input
              id="pg-deposit"
              type="number"
              min={0}
              max={100}
              value={depositPct}
              onChange={(e) => setDepositPct(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-pay">Payment days</Label>
            <Input
              id="pg-pay"
              type="number"
              min={0}
              value={paymentDays}
              onChange={(e) => setPaymentDays(Number.parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        <Button
          type="button"
          disabled={pending || !ok}
          onClick={() => {
            if (!ok) return;
            startTransition(async () => {
              const state = await saveDraftScenario({
                productId: product.id,
                productName: product.name,
                quantity,
                depositPct,
                paymentDays,
                marginPct,
                costRunId: product.costRunId,
                costRun: toCostRunInput(product.costRun) ?? null,
                settings: product.settings,
              });
              setSaveState(state);
            });
          }}
        >
          {pending ? "Saving…" : "Save internal draft"}
        </Button>
        {saveState.status === "error" ? (
          <p className="text-sm text-destructive">{saveState.message}</p>
        ) : null}
        {saveState.status === "ok" ? (
          <p className="text-sm text-muted-foreground">{saveState.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {ok ? (
          <>
            <div className="rounded-lg border p-4 text-sm">
              <h2 className="font-medium">Result</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Unit price (low–high)</dt>
                <dd className="tabular-nums">
                  {formatEuroCents(ok.low.unitPriceCents)} –{" "}
                  {formatEuroCents(ok.high.unitPriceCents)}
                </dd>
                <dt className="text-muted-foreground">Total (low–high)</dt>
                <dd className="tabular-nums">
                  {formatEuroCents(ok.low.totalCents)} –{" "}
                  {formatEuroCents(ok.high.totalCents)}
                </dd>
                <dt className="text-muted-foreground">Deposit</dt>
                <dd className="tabular-nums">
                  {formatEuroCents(ok.deposit.lowCents)} –{" "}
                  {formatEuroCents(ok.deposit.highCents)}
                </dd>
                <dt className="text-muted-foreground">Surcharge</dt>
                <dd>{formatPct(ok.surchargePct)}</dd>
                <dt className="text-muted-foreground">Cost source</dt>
                <dd>
                  {ok.costSource.kind === "computed"
                    ? `Computed · ${ok.costSource.runAt.toLocaleDateString("de-DE")} · ${formatPct(ok.costSource.coveragePct)} coverage`
                    : `Estimated (${ok.costSource.reason.replaceAll("_", " ")})`}
                </dd>
                <dt className="text-muted-foreground">Peak pre-financing</dt>
                <dd className="tabular-nums">
                  {ok.cashFlow.peakPreFinancingCents > 0
                    ? `${formatEuroCents(ok.cashFlow.peakPreFinancingCents)} (month ${ok.cashFlow.peakMonth})`
                    : "None"}
                </dd>
                <dt className="text-muted-foreground">First delivery</dt>
                <dd>Month {ok.delivery.firstDeliveryMonth}</dd>
                <dt className="text-muted-foreground">Batches</dt>
                <dd>{ok.delivery.batches.length}</dd>
              </dl>
              {ok.warnings.length > 0 ? (
                <ul className="mt-3 list-inside list-disc text-xs text-muted-foreground">
                  {ok.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`}>{warningLabel(w)}</li>
                  ))}
                </ul>
              ) : null}
              {ok.approval.required ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Would need approval if sent: {ok.approval.reasons.join(", ")}.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Quote text (indicative)</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(quoteText(ok, product.name));
                  }}
                >
                  Copy
                </Button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                {quoteText(ok, product.name)}
              </pre>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function warningLabel(w: QuoteResult["warnings"][number]): string {
  switch (w.code) {
    case "pre_financing_needed":
      return `Pre-financing needed (peak ${formatEuroCents(w.peakCents)}, month ${w.month})`;
    case "deposit_below_first_batch_cost":
      return "Deposit below first-batch cost";
    case "floor_sets_price":
      return "Floor sets the price";
    case "cost_estimated":
      return "Cost estimated (not from a high-coverage cost run)";
    case "cost_run_stale":
      return `Cost run is ${w.ageDays} days old`;
    case "line_flag":
      return `${w.mpn}: ${w.flag}`;
    default:
      return "Warning";
  }
}
