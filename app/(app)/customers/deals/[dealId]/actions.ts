"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  attachSalesDocument,
  createSalesOrder,
  logSalesInvoice,
  upsertSalesShipment,
} from "@/lib/sales/orders";

export type DealActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  orderId?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Logs a sales order (intent or ordered) against the deal. */
export async function logOrderAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "sales_orders", "insert")) {
    return { status: "error", message: "You cannot log orders." };
  }

  const dealId = field(formData, "deal_id");
  const companyId = field(formData, "company_id");
  if (!dealId || !companyId) {
    return { status: "error", message: "Deal and company are required." };
  }

  const qtyRaw = field(formData, "qty");
  const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) : null;
  if (qtyRaw && (!Number.isFinite(qty) || qty! < 1)) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }

  const statusRaw = field(formData, "status") || "intent";
  const status =
    statusRaw === "ordered" || statusRaw === "quoted" ? statusRaw : "intent";

  try {
    const order = await createSalesOrder({
      actorId: user.id,
      dealId,
      companyId,
      quoteId: field(formData, "quote_id") || null,
      productId: field(formData, "product_id") || null,
      qty,
      status,
      notes: field(formData, "notes") || null,
    });
    revalidatePath(`/customers/deals/${dealId}`);
    revalidatePath("/orders");
    return { status: "ok", message: "Order logged.", orderId: order.id };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not log order.",
    };
  }
}

/** Logs an external invoice against an order. */
export async function logInvoiceAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "sales_invoices", "insert")) {
    return { status: "error", message: "You cannot log invoices." };
  }

  const orderId = field(formData, "order_id");
  const dealId = field(formData, "deal_id");
  const euros = field(formData, "amount_euros").replace(",", ".");
  const amount = Number.parseFloat(euros);
  if (!orderId || !Number.isFinite(amount) || amount < 0) {
    return { status: "error", message: "Order and amount are required." };
  }

  const amountCents = Math.round(amount * 100);
  const paid = field(formData, "mark_paid") === "1";

  try {
    await logSalesInvoice({
      actorId: user.id,
      orderId,
      externalNumber: field(formData, "external_number") || null,
      amountCents,
      status: paid ? "paid" : "sent",
      pdfUrl: field(formData, "pdf_url") || null,
    });
    if (dealId) revalidatePath(`/customers/deals/${dealId}`);
    revalidatePath("/orders");
    return { status: "ok", message: paid ? "Invoice logged as paid." : "Invoice logged." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not log invoice.",
    };
  }
}

/** Updates shipment readiness. */
export async function updateShipmentAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "sales_shipments", "update")) {
    return { status: "error", message: "You cannot update shipments." };
  }

  const orderId = field(formData, "order_id");
  const dealId = field(formData, "deal_id");
  const statusRaw = field(formData, "status");
  if (
    !orderId ||
    (statusRaw !== "not_ready" && statusRaw !== "ready" && statusRaw !== "shipped")
  ) {
    return { status: "error", message: "Order and status are required." };
  }

  try {
    await upsertSalesShipment({
      actorId: user.id,
      orderId,
      status: statusRaw,
      tracking: field(formData, "tracking") || null,
      eta: field(formData, "eta") || null,
      notes: field(formData, "notes") || null,
    });
    if (dealId) revalidatePath(`/customers/deals/${dealId}`);
    revalidatePath("/orders");
    return { status: "ok", message: "Shipment updated." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update shipment.",
    };
  }
}

/** Attaches external PDF URL metadata to an order. */
export async function attachDocumentAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "sales_documents", "insert")) {
    return { status: "error", message: "You cannot attach documents." };
  }

  const orderId = field(formData, "order_id");
  const dealId = field(formData, "deal_id");
  const filename = field(formData, "filename");
  if (!orderId || !filename) {
    return { status: "error", message: "Order and filename are required." };
  }

  const kindRaw = field(formData, "kind");
  const kind =
    kindRaw === "quote_pdf" || kindRaw === "invoice_pdf" ? kindRaw : "other";

  try {
    await attachSalesDocument({
      actorId: user.id,
      orderId,
      kind,
      filename,
      url: field(formData, "url") || null,
    });
    if (dealId) revalidatePath(`/customers/deals/${dealId}`);
    revalidatePath("/orders");
    return { status: "ok", message: "Document attached." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not attach document.",
    };
  }
}
