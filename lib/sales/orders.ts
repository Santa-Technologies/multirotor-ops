import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  companies,
  pipedriveDeals,
  products,
  salesDocuments,
  salesInvoices,
  salesOrders,
  salesShipments,
} from "@/db/schema";
import { withActor } from "@/db/with-actor";

export type CreateSalesOrderInput = {
  actorId: string;
  dealId?: string | null;
  companyId: string;
  quoteId?: string | null;
  productId?: string | null;
  qty?: number | null;
  status?:
    | "intent"
    | "quoted"
    | "ordered"
    | "invoiced"
    | "paid"
    | "shipped"
    | "cancelled";
  notes?: string | null;
};

/** Creates a sales order row (intent is the default first step). */
export async function createSalesOrder(input: CreateSalesOrderInput) {
  return withActor(input.actorId, async (tx) => {
    const [row] = await tx
      .insert(salesOrders)
      .values({
        dealId: input.dealId ?? null,
        companyId: input.companyId,
        quoteId: input.quoteId ?? null,
        productId: input.productId ?? null,
        qty: input.qty ?? null,
        status: input.status ?? "intent",
        notes: input.notes ?? null,
      })
      .returning();
    return row!;
  });
}

export type LogInvoiceInput = {
  actorId: string;
  orderId: string;
  externalNumber?: string | null;
  amountCents: number;
  currency?: string;
  status?: "draft" | "sent" | "paid" | "void";
  pdfUrl?: string | null;
};

/** Logs an external invoice against an order (does not generate accounting PDFs). */
export async function logSalesInvoice(input: LogInvoiceInput) {
  return withActor(input.actorId, async (tx) => {
    const [row] = await tx
      .insert(salesInvoices)
      .values({
        orderId: input.orderId,
        externalNumber: input.externalNumber ?? null,
        amountCents: input.amountCents,
        currency: (input.currency ?? "EUR").toUpperCase(),
        status: input.status ?? "sent",
        pdfUrl: input.pdfUrl ?? null,
        paidAt: input.status === "paid" ? new Date() : null,
      })
      .returning();

    if (input.status === "paid" || input.status === "sent") {
      await tx
        .update(salesOrders)
        .set({
          status: input.status === "paid" ? "paid" : "invoiced",
        })
        .where(eq(salesOrders.id, input.orderId));
    }

    return row!;
  });
}

export type UpsertShipmentInput = {
  actorId: string;
  orderId: string;
  status: "not_ready" | "ready" | "shipped";
  tracking?: string | null;
  eta?: string | null;
  notes?: string | null;
};

/** Creates or updates shipment readiness for an order. */
export async function upsertSalesShipment(input: UpsertShipmentInput) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(salesShipments)
    .where(eq(salesShipments.orderId, input.orderId))
    .limit(1);

  return withActor(input.actorId, async (tx) => {
    const values = {
      status: input.status,
      tracking: input.tracking ?? null,
      eta: input.eta ?? null,
      notes: input.notes ?? null,
      shippedAt:
        input.status === "shipped" ? new Date().toISOString().slice(0, 10) : null,
    };

    if (existing) {
      const [row] = await tx
        .update(salesShipments)
        .set(values)
        .where(eq(salesShipments.id, existing.id))
        .returning();
      if (input.status === "shipped") {
        await tx
          .update(salesOrders)
          .set({ status: "shipped", shippedAt: values.shippedAt })
          .where(eq(salesOrders.id, input.orderId));
      }
      return row!;
    }

    const [row] = await tx
      .insert(salesShipments)
      .values({ orderId: input.orderId, ...values })
      .returning();
    if (input.status === "shipped") {
      await tx
        .update(salesOrders)
        .set({ status: "shipped", shippedAt: values.shippedAt })
        .where(eq(salesOrders.id, input.orderId));
    }
    return row!;
  });
}

export type AttachDocumentInput = {
  actorId: string;
  kind: "quote_pdf" | "invoice_pdf" | "other";
  orderId?: string | null;
  quoteId?: string | null;
  filename: string;
  url?: string | null;
};

/** Attaches external PDF metadata (no file upload storage in this phase). */
export async function attachSalesDocument(input: AttachDocumentInput) {
  return withActor(input.actorId, async (tx) => {
    const [row] = await tx
      .insert(salesDocuments)
      .values({
        kind: input.kind,
        orderId: input.orderId ?? null,
        quoteId: input.quoteId ?? null,
        filename: input.filename,
        url: input.url ?? null,
        uploadedBy: input.actorId,
      })
      .returning();
    return row!;
  });
}

/** Paginated sales orders list. */
export async function listSalesOrders(page = 1, pageSize = 25) {
  const db = getDb();
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = await db
    .select({
      order: salesOrders,
      companyName: companies.name,
      productName: products.name,
      dealTitle: pipedriveDeals.title,
    })
    .from(salesOrders)
    .innerJoin(companies, eq(companies.id, salesOrders.companyId))
    .leftJoin(products, eq(products.id, salesOrders.productId))
    .leftJoin(pipedriveDeals, eq(pipedriveDeals.id, salesOrders.dealId))
    .orderBy(desc(salesOrders.createdAt))
    .limit(pageSize)
    .offset(offset);
  return rows;
}

export async function getOrderWithRelated(orderId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      order: salesOrders,
      companyName: companies.name,
      productName: products.name,
      dealTitle: pipedriveDeals.title,
    })
    .from(salesOrders)
    .innerJoin(companies, eq(companies.id, salesOrders.companyId))
    .leftJoin(products, eq(products.id, salesOrders.productId))
    .leftJoin(pipedriveDeals, eq(pipedriveDeals.id, salesOrders.dealId))
    .where(eq(salesOrders.id, orderId))
    .limit(1);
  if (!row) return null;

  const [invoices, shipments, documents] = await Promise.all([
    db.select().from(salesInvoices).where(eq(salesInvoices.orderId, orderId)),
    db.select().from(salesShipments).where(eq(salesShipments.orderId, orderId)),
    db.select().from(salesDocuments).where(eq(salesDocuments.orderId, orderId)),
  ]);

  return { ...row, invoices, shipments, documents };
}
