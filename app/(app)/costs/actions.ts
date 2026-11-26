"use server";

import { revalidatePath } from "next/cache";

import { assemblyPrices, manualQuotes } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { runCostRunForProduct } from "@/lib/costing/run-cost-run";
import { parseEuroToCents } from "@/lib/format/money";

export type CostActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Runs a cost calculation for one variant from current BOM + manual prices. */
export async function runCostAction(
  _prev: CostActionState,
  formData: FormData,
): Promise<CostActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "cost_runs", "insert")) {
    return { status: "error", message: "You cannot run a cost calculation." };
  }
  const productId = field(formData, "product_id");
  if (!productId) return { status: "error", message: "Choose a product." };

  try {
    const result = await runCostRunForProduct(productId, user.id);
    revalidatePath("/costs");
    revalidatePath("/quotes");
    revalidatePath("/");
    const nexarNote =
      result.snapshotCount > 0
        ? ` ${result.snapshotCount} API snapshot(s).`
        : process.env.NEXAR_CLIENT_ID
          ? " No new API snapshots (check credentials or MPN coverage)."
          : " Nexar not configured — manual quotes only.";
    const errNote =
      result.providerErrors.length > 0
        ? ` Provider notes: ${result.providerErrors.slice(0, 2).join("; ")}`
        : "";
    return {
      status: "ok",
      message: `Cost run saved. Coverage ${result.coveragePct} %, ${result.flagCount} flag(s).${nexarNote}${errNote}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Cost run failed.",
    };
  }
}

/** Logs a manual supplier quote for a part MPN. */
export async function addManualQuoteAction(
  _prev: CostActionState,
  formData: FormData,
): Promise<CostActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "manual_quotes", "insert")) {
    return { status: "error", message: "You cannot enter supplier quotes." };
  }

  const mpn = field(formData, "mpn");
  const supplier = field(formData, "supplier");
  const qty = Number.parseInt(field(formData, "qty"), 10);
  const unitCents = parseEuroToCents(field(formData, "unit_price_euros"));
  const quotedAt = field(formData, "quoted_at") || new Date().toISOString().slice(0, 10);
  const validUntil = field(formData, "valid_until") || null;

  if (!mpn || !supplier) {
    return { status: "error", message: "MPN and supplier are required." };
  }
  if (!Number.isFinite(qty) || qty < 1) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }
  if (unitCents == null) {
    return { status: "error", message: "Enter a unit price in euros (e.g. 12,50)." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(manualQuotes).values({
        mpn,
        supplier,
        qty,
        unitPriceCents: unitCents,
        quotedAt,
        validUntil,
        sourceNote: field(formData, "note") || null,
        enteredBy: user.id,
      });
    });
    revalidatePath("/costs");
    return { status: "ok", message: "Supplier quote saved." };
  } catch {
    return { status: "error", message: "Could not save the supplier quote." };
  }
}

/** Logs an assembly price for a product variant. */
export async function addAssemblyPriceAction(
  _prev: CostActionState,
  formData: FormData,
): Promise<CostActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "assembly_prices", "insert")) {
    return { status: "error", message: "You cannot enter assembly prices." };
  }

  const productId = field(formData, "product_id");
  const assembler = field(formData, "assembler");
  const qtyTier = Number.parseInt(field(formData, "qty_tier"), 10);
  const unitCents = parseEuroToCents(field(formData, "unit_price_euros"));
  const setupCents = parseEuroToCents(field(formData, "setup_euros") || "0") ?? 0;
  const quotedAt = field(formData, "quoted_at") || new Date().toISOString().slice(0, 10);
  const validUntil = field(formData, "valid_until") || null;

  if (!productId || !assembler) {
    return { status: "error", message: "Product and assembler are required." };
  }
  if (!Number.isFinite(qtyTier) || qtyTier < 1) {
    return { status: "error", message: "Quantity tier must be a positive integer." };
  }
  if (unitCents == null) {
    return { status: "error", message: "Enter a unit assembly price in euros." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(assemblyPrices).values({
        productId,
        assembler,
        qtyTier,
        unitPriceCents: unitCents,
        setupCostCents: setupCents,
        quotedAt,
        validUntil,
      });
    });
    revalidatePath("/costs");
    return { status: "ok", message: "Assembly price saved." };
  } catch {
    return { status: "error", message: "Could not save the assembly price." };
  }
}
