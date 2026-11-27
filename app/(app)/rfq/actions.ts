"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { distributors, suppliers } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { confirmRfqOffer, rejectRfqOffer } from "@/lib/rfq/confirm-offer";
import { createAndSendRfq } from "@/lib/rfq/create-rfq";
import { parseEuroToCents } from "@/lib/format/money";

export type RfqActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalBool(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

/** Creates a distributor directory row with RFQ contact and address. */
export async function createDistributorAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "distributors", "insert")) {
    return { status: "error", message: "You cannot create distributors." };
  }

  const name = field(formData, "name");
  if (!name) return { status: "error", message: "Name is required." };

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(distributors).values({
        name,
        rfqEmail: field(formData, "rfq_email") || null,
        rfqContactName: field(formData, "rfq_contact_name") || null,
        addressLine: field(formData, "address_line") || null,
        city: field(formData, "city") || null,
        postalCode: field(formData, "postal_code") || null,
        country: field(formData, "country") || null,
        approved: optionalBool(formData, "approved"),
        hostKey: field(formData, "host_key") || null,
      });
    });
    revalidatePath("/rfq");
    revalidatePath("/costs");
    return { status: "ok", message: "Distributor saved." };
  } catch {
    return {
      status: "error",
      message: "Could not save distributor (name or host key may already exist).",
    };
  }
}

/** Updates distributor RFQ contact and postal address fields. */
export async function updateDistributorAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "distributors", "update")) {
    return { status: "error", message: "You cannot update distributors." };
  }

  const id = field(formData, "distributor_id");
  const name = field(formData, "name");
  if (!id || !name) {
    return { status: "error", message: "Distributor and name are required." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx
        .update(distributors)
        .set({
          name,
          rfqEmail: field(formData, "rfq_email") || null,
          rfqContactName: field(formData, "rfq_contact_name") || null,
          addressLine: field(formData, "address_line") || null,
          city: field(formData, "city") || null,
          postalCode: field(formData, "postal_code") || null,
          country: field(formData, "country") || null,
          approved: optionalBool(formData, "approved"),
          hostKey: field(formData, "host_key") || null,
        })
        .where(eq(distributors.id, id));
    });
    revalidatePath("/rfq");
    revalidatePath("/costs");
    return { status: "ok", message: "Distributor updated." };
  } catch {
    return {
      status: "error",
      message: "Could not update distributor (name or host key may already exist).",
    };
  }
}

/** Creates a supplier registry row. */
export async function createSupplierAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "suppliers", "insert")) {
    return { status: "error", message: "You cannot manage suppliers." };
  }

  const name = field(formData, "name");
  const email = field(formData, "email");
  const notes = field(formData, "notes") || null;
  if (!name || !email) {
    return { status: "error", message: "Name and email are required." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(suppliers).values({ name, email, notes, active: true });
    });
    revalidatePath("/rfq");
    return { status: "ok", message: "Supplier saved." };
  } catch {
    return {
      status: "error",
      message: "Could not save supplier (name or email may already exist).",
    };
  }
}

/** Sends a deduped RFQ email for one part. */
export async function sendRfqAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "rfq_threads", "insert")) {
    return { status: "error", message: "You cannot send RFQs." };
  }

  const partId = field(formData, "part_id");
  const supplierId = field(formData, "supplier_id");
  const qty = Number.parseInt(field(formData, "qty"), 10);
  if (!partId || !supplierId) {
    return { status: "error", message: "Choose a part and a supplier." };
  }

  const result = await createAndSendRfq({
    partId,
    supplierId,
    qtyRequested: qty,
    actorId: user.id,
    notes: field(formData, "notes") || null,
  });

  revalidatePath("/rfq");
  revalidatePath("/costs");

  if (!result.ok) return { status: "error", message: result.error };
  if (result.deduped) {
    return {
      status: "ok",
      message: `Open RFQ already exists (${result.subjectToken}) — no second email sent.`,
    };
  }
  return {
    status: "ok",
    message: `RFQ sent (${result.subjectToken}).`,
  };
}

/** Confirms a parsed offer and writes manual_quotes. */
export async function confirmOfferAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "rfq_offers", "update")) {
    return { status: "error", message: "You cannot confirm offers." };
  }

  const offerId = field(formData, "offer_id");
  const qty = Number.parseInt(field(formData, "qty"), 10);
  const unitCents = parseEuroToCents(field(formData, "unit_price_euros"));
  const validUntil = field(formData, "valid_until") || null;
  const stockRaw = field(formData, "stock");
  const stock = stockRaw ? Number.parseInt(stockRaw, 10) : null;

  if (!offerId) return { status: "error", message: "Missing offer." };
  if (unitCents == null) {
    return { status: "error", message: "Enter a unit price in euros (e.g. 1,25)." };
  }

  try {
    await confirmRfqOffer({
      offerId,
      actorId: user.id,
      qty,
      unitPriceCents: unitCents,
      validUntil,
      stock: Number.isFinite(stock) ? stock : null,
    });
    revalidatePath("/rfq");
    revalidatePath("/costs");
    return { status: "ok", message: "Offer confirmed and saved as a supplier quote." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Confirm failed.",
    };
  }
}

/** Rejects a pending offer without writing prices. */
export async function rejectOfferAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "rfq_offers", "update")) {
    return { status: "error", message: "You cannot reject offers." };
  }
  const offerId = field(formData, "offer_id");
  if (!offerId) return { status: "error", message: "Missing offer." };

  try {
    await rejectRfqOffer(offerId, user.id);
    revalidatePath("/rfq");
    return { status: "ok", message: "Offer rejected." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Reject failed.",
    };
  }
}

/** Soft-deactivates a supplier. */
export async function deactivateSupplierAction(
  _prev: RfqActionState,
  formData: FormData,
): Promise<RfqActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "suppliers", "update")) {
    return { status: "error", message: "You cannot manage suppliers." };
  }
  const id = field(formData, "supplier_id");
  if (!id) return { status: "error", message: "Missing supplier." };

  try {
    await withActor(user.id, async (tx) => {
      await tx.update(suppliers).set({ active: false }).where(eq(suppliers.id, id));
    });
    revalidatePath("/rfq");
    return { status: "ok", message: "Supplier deactivated." };
  } catch {
    return { status: "error", message: "Could not deactivate supplier." };
  }
}
