"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { distributors } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { createAndSendRfq } from "@/lib/rfq/create-rfq";
import { ensureSupplierForDistributor } from "@/lib/rfq/ensure-supplier-from-distributor";

export type MissingRfqActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Sets RFQ email on a distributor directory row. */
export async function setDistributorRfqEmailAction(
  _prev: MissingRfqActionState,
  formData: FormData,
): Promise<MissingRfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "distributors", "update")) {
    return { status: "error", message: "You cannot update distributors." };
  }

  const id = field(formData, "distributor_id");
  const email = field(formData, "rfq_email");
  if (!id || !email) {
    return { status: "error", message: "Distributor and email are required." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx
        .update(distributors)
        .set({
          rfqEmail: email,
          rfqContactName: field(formData, "rfq_contact_name") || null,
        })
        .where(eq(distributors.id, id));
    });
    revalidatePath("/costs");
    revalidatePath("/rfq");
    return { status: "ok", message: "Distributor RFQ email saved." };
  } catch {
    return { status: "error", message: "Could not save RFQ email." };
  }
}

/** Bulk-sends RFQs for checked missing parts via distributor RFQ emails. */
export async function bulkSendMissingRfqAction(
  _prev: MissingRfqActionState,
  formData: FormData,
): Promise<MissingRfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "rfq_threads", "insert")) {
    return { status: "error", message: "You cannot send RFQs." };
  }

  const partIds = formData.getAll("part_id").map(String).filter(Boolean);
  const distributorIds = formData
    .getAll("distributor_id")
    .map(String)
    .filter(Boolean);
  const qty = Number.parseInt(field(formData, "qty") || "100", 10);
  if (partIds.length === 0) {
    return { status: "error", message: "Select at least one part." };
  }
  if (!Number.isFinite(qty) || qty < 1) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }

  let sent = 0;
  let deduped = 0;
  const errors: string[] = [];

  for (let i = 0; i < partIds.length; i++) {
    const partId = partIds[i]!;
    const distributorId = distributorIds[i];
    if (!distributorId) {
      errors.push(`Missing distributor for part ${partId}`);
      continue;
    }
    const supplier = await ensureSupplierForDistributor(distributorId, user.id);
    if ("error" in supplier) {
      errors.push(supplier.error);
      continue;
    }
    const result = await createAndSendRfq({
      partId,
      supplierId: supplier.supplierId,
      qtyRequested: qty,
      actorId: user.id,
    });
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    if (result.deduped) deduped++;
    else sent++;
  }

  revalidatePath("/costs");
  revalidatePath("/rfq");

  if (sent === 0 && deduped === 0) {
    return {
      status: "error",
      message: errors[0] ?? "No RFQs sent.",
    };
  }

  return {
    status: "ok",
    message: `Sent ${sent}, already open ${deduped}${
      errors.length ? `, ${errors.length} failed` : ""
    }.`,
  };
}
