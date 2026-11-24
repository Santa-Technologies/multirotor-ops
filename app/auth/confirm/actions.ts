"use server";

import { redirect } from "next/navigation";

import { findAllowedEntry } from "@/lib/auth/allowlist";
import { parseEmailLinkParams } from "@/lib/auth/email-link";
import { ensureUserRow } from "@/lib/auth/sync-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes a magic-link sign-in after the user clicks "Continue". Verifies
 * the token hash (or legacy PKCE code) with Supabase, re-checks the allowlist,
 * creates the users row on first login and redirects to the dashboard.
 */
export async function confirmSignIn(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  for (const key of ["token_hash", "type", "code"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  const link = parseEmailLinkParams(params);
  if (link.kind === "invalid") redirect("/login?error=link_invalid");

  const supabase = await createSupabaseServerClient();
  const { error } =
    link.kind === "token_hash"
      ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await supabase.auth.exchangeCodeForSession(link.code);

  if (error) {
    console.warn("Magic link verification failed", {
      flow: link.kind,
      code: error.code,
      status: error.status,
    });
    redirect("/login?error=link_invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const entry = findAllowedEntry(user?.email);

  // Someone could create a Supabase user directly with the public key; the
  // allowlist is re-checked here so such a session is discarded immediately.
  if (!user || !entry) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  try {
    await ensureUserRow(user.id, entry);
  } catch (err) {
    console.error("Could not create users row", { userId: user.id, err });
    await supabase.auth.signOut();
    redirect("/login?error=server");
  }

  redirect("/");
}
