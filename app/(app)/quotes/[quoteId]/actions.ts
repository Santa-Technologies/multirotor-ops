"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import {
  approveQuote,
  markQuoteSent,
  reviseSentQuote,
} from "@/lib/quotes/lifecycle";

export type QuoteLifecycleState = {
  status: "idle" | "ok" | "error";
  message?: string;
  newQuoteId?: string;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Admin approves a draft that requires approval. */
export async function approveQuoteAction(
  _prev: QuoteLifecycleState,
  formData: FormData,
): Promise<QuoteLifecycleState> {
  const user = await requireUser();
  if (user.role !== "admin") {
    return { status: "error", message: "Only admin can approve quotes." };
  }
  const quoteId = field(formData, "quote_id");
  if (!quoteId) return { status: "error", message: "Missing quote." };

  try {
    await approveQuote(quoteId, user.id);
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/");
    return { status: "ok", message: "Quote approved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Approval failed.",
    };
  }
}

/** Sales marks a draft as sent (immutable). Optionally notes Pipedrive. */
export async function markSentAction(
  _prev: QuoteLifecycleState,
  formData: FormData,
): Promise<QuoteLifecycleState> {
  const user = await requireUser();
  if (!canWrite(user.role, "quotes", "update")) {
    return { status: "error", message: "You cannot mark quotes as sent." };
  }

  const quoteId = field(formData, "quote_id");
  const companyId = field(formData, "company_id");
  if (!quoteId || !companyId) {
    return { status: "error", message: "Quote and company are required." };
  }

  const dealRaw = field(formData, "pipedrive_deal_id");
  const pipedriveDealId = dealRaw ? Number.parseInt(dealRaw, 10) : null;
  const postNote = field(formData, "post_pipedrive_note") === "1";

  try {
    await markQuoteSent({
      quoteId,
      actorId: user.id,
      companyId,
      pipedriveDealId:
        pipedriveDealId != null && Number.isFinite(pipedriveDealId)
          ? pipedriveDealId
          : null,
      postPipedriveNote: postNote,
    });
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/");
    return {
      status: "ok",
      message: postNote
        ? "Quote marked sent. Pipedrive deal note posted when a deal was linked."
        : "Quote marked sent.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Mark sent failed.",
    };
  }
}

/** Creates a new draft version from a sent quote. */
export async function reviseQuoteAction(
  _prev: QuoteLifecycleState,
  formData: FormData,
): Promise<QuoteLifecycleState> {
  const user = await requireUser();
  if (!canWrite(user.role, "quotes", "insert")) {
    return { status: "error", message: "You cannot revise quotes." };
  }
  const quoteId = field(formData, "quote_id");
  if (!quoteId) return { status: "error", message: "Missing quote." };

  try {
    const created = await reviseSentQuote(quoteId, user.id);
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${created.id}`);
    return {
      status: "ok",
      message: `Created draft version ${created.version} of ${created.number}.`,
      newQuoteId: created.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Revise failed.",
    };
  }
}
