"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { assemblyLots, finishedGoods, partInventory, parts } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";

export type InventoryActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseNonNegInt(raw: string, label: string): number | { error: string } {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return { error: `${label} must be zero or a positive integer.` };
  return n;
}

/** Upserts on-hand / on-order stock for a part (by part id or MPN). */
export async function upsertPartInventoryAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "part_inventory", "insert")) {
    return { status: "error", message: "You cannot edit part inventory." };
  }

  let partId = field(formData, "part_id");
  const mpn = field(formData, "mpn");
  const onHand = parseNonNegInt(field(formData, "on_hand") || "0", "On hand");
  const onOrderQty = parseNonNegInt(field(formData, "on_order_qty") || "0", "On order");
  if (typeof onHand === "object") return { status: "error", message: onHand.error };
  if (typeof onOrderQty === "object") return { status: "error", message: onOrderQty.error };

  const eta = field(formData, "eta") || null;
  const poRef = field(formData, "po_ref") || null;
  const notes = field(formData, "notes") || null;

  try {
    await withActor(user.id, async (tx) => {
      if (!partId && mpn) {
        const [part] = await tx
          .select({ id: parts.id })
          .from(parts)
          .where(sql`lower(${parts.mpn}) = lower(${mpn})`)
          .limit(1);
        if (!part) throw new Error(`No part with MPN "${mpn}". Import a BOM first.`);
        partId = part.id;
      }
      if (!partId) throw new Error("Choose a part or enter an MPN.");

      const [existing] = await tx
        .select({ id: partInventory.id })
        .from(partInventory)
        .where(eq(partInventory.partId, partId))
        .limit(1);

      if (existing) {
        await tx
          .update(partInventory)
          .set({ onHand, onOrderQty, eta, poRef, notes })
          .where(eq(partInventory.id, existing.id));
      } else {
        await tx.insert(partInventory).values({
          partId,
          onHand,
          onOrderQty,
          eta,
          poRef,
          notes,
        });
      }
    });
    revalidatePath("/inventory");
    revalidatePath("/");
    return { status: "ok", message: "Part stock saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save part stock.",
    };
  }
}

/** Upserts finished-goods quantity for a variant. */
export async function upsertFinishedGoodsAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "finished_goods", "insert")) {
    return { status: "error", message: "You cannot edit finished goods." };
  }

  const productId = field(formData, "product_id");
  const qty = parseNonNegInt(field(formData, "qty") || "0", "Quantity");
  if (!productId) return { status: "error", message: "Choose a product." };
  if (typeof qty === "object") return { status: "error", message: qty.error };
  const notes = field(formData, "notes") || null;

  try {
    await withActor(user.id, async (tx) => {
      const [existing] = await tx
        .select({ id: finishedGoods.id })
        .from(finishedGoods)
        .where(eq(finishedGoods.productId, productId))
        .limit(1);
      if (existing) {
        await tx
          .update(finishedGoods)
          .set({ qty, notes })
          .where(eq(finishedGoods.id, existing.id));
      } else {
        await tx.insert(finishedGoods).values({ productId, qty, notes });
      }
    });
    revalidatePath("/inventory");
    revalidatePath("/");
    return { status: "ok", message: "Finished goods saved." };
  } catch {
    return { status: "error", message: "Could not save finished goods." };
  }
}

const LOT_STATUSES = ["planned", "in_progress", "completed", "cancelled"] as const;

/** Creates an assembly / WIP lot. */
export async function createAssemblyLotAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "assembly_lots", "insert")) {
    return { status: "error", message: "You cannot create assembly lots." };
  }

  const productId = field(formData, "product_id");
  const qtyRaw = Number.parseInt(field(formData, "qty"), 10);
  const status = field(formData, "status") || "planned";
  if (!productId) return { status: "error", message: "Choose a product." };
  if (!Number.isFinite(qtyRaw) || qtyRaw < 1) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }
  if (!LOT_STATUSES.includes(status as (typeof LOT_STATUSES)[number])) {
    return { status: "error", message: "Invalid lot status." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(assemblyLots).values({
        productId,
        qty: qtyRaw,
        status: status as (typeof LOT_STATUSES)[number],
        eta: field(formData, "eta") || null,
        assembler: field(formData, "assembler") || null,
        notes: field(formData, "notes") || null,
      });
    });
    revalidatePath("/inventory");
    revalidatePath("/");
    return { status: "ok", message: "Assembly lot created." };
  } catch {
    return { status: "error", message: "Could not create the assembly lot." };
  }
}

/** Updates status / ETA on an existing assembly lot. */
export async function updateAssemblyLotAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "assembly_lots", "update")) {
    return { status: "error", message: "You cannot update assembly lots." };
  }

  const lotId = field(formData, "lot_id");
  const status = field(formData, "status");
  if (!lotId) return { status: "error", message: "Missing lot." };
  if (!LOT_STATUSES.includes(status as (typeof LOT_STATUSES)[number])) {
    return { status: "error", message: "Invalid lot status." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx
        .update(assemblyLots)
        .set({
          status: status as (typeof LOT_STATUSES)[number],
          eta: field(formData, "eta") || null,
          assembler: field(formData, "assembler") || null,
          notes: field(formData, "notes") || null,
        })
        .where(eq(assemblyLots.id, lotId));
    });
    revalidatePath("/inventory");
    revalidatePath("/");
    return { status: "ok", message: "Assembly lot updated." };
  } catch {
    return { status: "error", message: "Could not update the assembly lot." };
  }
}
