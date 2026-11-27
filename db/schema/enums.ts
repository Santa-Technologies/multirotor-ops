import { pgEnum } from "drizzle-orm/pg-core";

import { ROLES } from "@/lib/auth/allowlist";

export const userRole = pgEnum("user_role", ROLES);

export const pricingMode = pgEnum("pricing_mode", ["cost_plus", "list_price"]);

export const sourceChannel = pgEnum("source_channel", [
  "linkedin",
  "signal",
  "email",
  "trade_fair",
]);

export const requestType = pgEnum("request_type", [
  "feature",
  "custom_variant",
  "quote",
  "integration_issue",
  "bug",
  "other",
]);

// The spec names urgency but not its values.
export const requestUrgency = pgEnum("request_urgency", ["low", "normal", "high"]);

export const requestStatus = pgEnum("request_status", [
  "new",
  "triaged",
  "accepted",
  "planned",
  "declined",
  "done",
]);

// The spec names requirement status but not its values.
export const requirementStatus = pgEnum("requirement_status", [
  "open",
  "planned",
  "done",
  "declined",
]);

export const bomSourcing = pgEnum("bom_sourcing", ["distributor", "direct_quote"]);

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "expired",
  "lost",
]);

export const approvalStatus = pgEnum("approval_status", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);

export const activityAction = pgEnum("activity_action", ["insert", "update", "delete"]);

/** WIP / assembly batch lifecycle for finished-goods production. */
export const assemblyLotStatus = pgEnum("assembly_lot_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Outbound RFQ email / reply lifecycle (one open thread per part). */
export const rfqThreadStatus = pgEnum("rfq_thread_status", [
  "draft",
  "sent",
  "awaiting_reply",
  "offer_received",
  "confirmed",
  "closed",
  "cancelled",
]);

/** Parsed supplier offer waiting for human confirm before write. */
export const rfqOfferStatus = pgEnum("rfq_offer_status", [
  "pending_confirm",
  "confirmed",
  "rejected",
]);

/** Pipedrive deal status (one-way import; we do not write stages back yet). */
export const pipedriveDealStatus = pgEnum("pipedrive_deal_status", [
  "open",
  "won",
  "lost",
  "deleted",
]);

/** Commercial sales-order lifecycle (intent → quote → order → pay → ship). */
export const salesOrderStatus = pgEnum("sales_order_status", [
  "intent",
  "quoted",
  "ordered",
  "invoiced",
  "paid",
  "shipped",
  "cancelled",
]);

export const salesInvoiceStatus = pgEnum("sales_invoice_status", [
  "draft",
  "sent",
  "paid",
  "void",
]);

export const salesShipmentStatus = pgEnum("sales_shipment_status", [
  "not_ready",
  "ready",
  "shipped",
]);

/** External quote/invoice PDF attach kind. */
export const salesDocumentKind = pgEnum("sales_document_kind", [
  "quote_pdf",
  "invoice_pdf",
  "other",
]);
