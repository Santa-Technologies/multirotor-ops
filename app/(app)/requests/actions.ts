"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { companies, contacts, requests } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";

export type RequestActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const REQUEST_TYPES = [
  "feature",
  "custom_variant",
  "quote",
  "integration_issue",
  "bug",
  "other",
] as const;

const REQUEST_STATUSES = [
  "new",
  "triaged",
  "accepted",
  "planned",
  "declined",
  "done",
] as const;

const CHANNELS = ["linkedin", "signal", "email", "trade_fair"] as const;
const URGENCIES = ["low", "normal", "high"] as const;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function asEnum<T extends readonly string[]>(
  value: string,
  allowed: T,
): T[number] | null {
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

/** Sales creates a local company (may later match Pipedrive on sync). */
export async function createCompanyAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "companies", "insert")) {
    return { status: "error", message: "You cannot create companies." };
  }
  const name = field(formData, "name");
  if (!name) return { status: "error", message: "Company name is required." };

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(companies).values({
        name,
        country: field(formData, "country") || null,
        website: field(formData, "website") || null,
      });
    });
    revalidatePath("/requests");
    revalidatePath("/customers");
    return { status: "ok", message: "Company saved." };
  } catch {
    return { status: "error", message: "Could not save company." };
  }
}

/** Sales creates a contact under a company. */
export async function createContactAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "contacts", "insert")) {
    return { status: "error", message: "You cannot create contacts." };
  }
  const companyId = field(formData, "company_id");
  const name = field(formData, "name");
  if (!companyId || !name) {
    return { status: "error", message: "Company and name are required." };
  }

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(contacts).values({
        companyId,
        name,
        email: field(formData, "email") || null,
        phone: field(formData, "phone") || null,
      });
    });
    revalidatePath("/requests");
    revalidatePath("/customers");
    return { status: "ok", message: "Contact saved." };
  } catch {
    return { status: "error", message: "Could not save contact." };
  }
}

/** Sales logs a new request (raw customer text stored as-is, no LLM). */
export async function createRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "requests", "insert")) {
    return { status: "error", message: "You cannot create requests." };
  }

  const companyId = field(formData, "company_id");
  const summary = field(formData, "summary");
  const type = asEnum(field(formData, "type"), REQUEST_TYPES);
  if (!companyId || !summary || !type) {
    return {
      status: "error",
      message: "Company, summary and type are required.",
    };
  }

  const qtyRaw = field(formData, "quantity");
  const quantity = qtyRaw ? Number.parseInt(qtyRaw, 10) : null;
  if (qtyRaw && (!Number.isFinite(quantity) || quantity! < 1)) {
    return { status: "error", message: "Quantity must be a positive integer." };
  }

  const channel = asEnum(field(formData, "source_channel"), CHANNELS);
  const urgency = asEnum(field(formData, "urgency"), URGENCIES);
  const dealRaw = field(formData, "pipedrive_deal_id");
  const pipedriveDealId = dealRaw ? Number.parseInt(dealRaw, 10) : null;

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(requests).values({
        companyId,
        contactId: field(formData, "contact_id") || null,
        sourceChannel: channel,
        summary,
        rawText: field(formData, "raw_text") || null,
        type,
        productId: field(formData, "product_id") || null,
        quantity,
        urgency,
        status: "new",
        ownerId: field(formData, "owner_id") || null,
        dueDate: field(formData, "due_date") || null,
        pipedriveDealId:
          pipedriveDealId != null && Number.isFinite(pipedriveDealId)
            ? pipedriveDealId
            : null,
      });
    });
    revalidatePath("/requests");
    revalidatePath("/");
    return { status: "ok", message: "Request logged." };
  } catch {
    return { status: "error", message: "Could not save request." };
  }
}

/** Sales or engineering updates triage fields. */
export async function updateRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "requests", "update")) {
    return { status: "error", message: "You cannot update requests." };
  }

  const id = field(formData, "request_id");
  const status = asEnum(field(formData, "status"), REQUEST_STATUSES);
  if (!id || !status) {
    return { status: "error", message: "Request and status are required." };
  }

  const dealRaw = field(formData, "pipedrive_deal_id");
  const pipedriveDealId = dealRaw ? Number.parseInt(dealRaw, 10) : null;

  try {
    await withActor(user.id, async (tx) => {
      await tx
        .update(requests)
        .set({
          status,
          ownerId: field(formData, "owner_id") || null,
          dueDate: field(formData, "due_date") || null,
          productId: field(formData, "product_id") || null,
          urgency: asEnum(field(formData, "urgency"), URGENCIES),
          pipedriveDealId:
            pipedriveDealId != null && Number.isFinite(pipedriveDealId)
              ? pipedriveDealId
              : null,
        })
        .where(eq(requests.id, id));
    });
    revalidatePath("/requests");
    revalidatePath("/");
    return { status: "ok", message: "Request updated." };
  } catch {
    return { status: "error", message: "Could not update request." };
  }
}
