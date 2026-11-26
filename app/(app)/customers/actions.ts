"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { syncPipedrive } from "@/lib/pipedrive/sync";

export type CustomerActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

/** One-way Pipedrive refresh into local companies, contacts and deals. */
export async function syncPipedriveAction(
  prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  void prev;
  void formData;
  const user = await requireUser();
  if (!canWrite(user.role, "pipedrive_deals", "insert")) {
    return { status: "error", message: "You cannot sync Pipedrive." };
  }
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return {
      status: "error",
      message: "PIPEDRIVE_API_TOKEN is not configured on this environment.",
    };
  }

  try {
    const result = await syncPipedrive(user.id);
    revalidatePath("/customers");
    revalidatePath("/requests");
    revalidatePath("/");
    return {
      status: "ok",
      message: `Synced ${result.organizations} orgs, ${result.persons} people, ${result.deals} open deals.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Pipedrive sync failed.",
    };
  }
}
