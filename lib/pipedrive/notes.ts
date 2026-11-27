import "server-only";

import { fetchJson } from "@/lib/pricing-providers/fetch-with-retry";

/**
 * Posts a note onto a Pipedrive deal (write-back used when a quote is marked sent).
 * Does not change deal stage.
 */
export async function addPipedriveDealNote(options: {
  dealId: number;
  contentHtml: string;
}): Promise<{ id: number }> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) {
    throw new Error("PIPEDRIVE_API_TOKEN is not configured.");
  }

  const url = new URL("https://api.pipedrive.com/api/v1/notes");
  url.searchParams.set("api_token", token);

  const payload = await fetchJson<{
    success?: boolean;
    data?: { id?: number };
    error?: string;
  }>({
    url: url.toString(),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: options.contentHtml,
      deal_id: options.dealId,
      pinned_to_deal_flag: 1,
    }),
    label: "Pipedrive note",
  });

  if (!payload.success || payload.data?.id == null) {
    throw new Error(payload.error ?? "Pipedrive note create failed.");
  }
  return { id: payload.data.id };
}
