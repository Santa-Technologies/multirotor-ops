import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { findAllowedEntry } from "@/lib/auth/allowlist";
import { ensureUserRow } from "@/lib/auth/sync-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes a magic-link sign-in. Accepts either the PKCE `code` (default
 * Supabase email template) or `token_hash` + `type` (recommended template,
 * works when the link is opened on another device), re-checks the allowlist,
 * creates the users row on first login and sends the user to the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const loginWithError = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, origin));

  const supabase = await createSupabaseServerClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return loginWithError("link_invalid");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const entry = findAllowedEntry(user?.email);

  // Someone could create a Supabase user directly with the public key; the
  // allowlist is re-checked here so such a session is discarded immediately.
  if (!user || !entry) {
    await supabase.auth.signOut();
    return loginWithError("not_allowed");
  }

  try {
    await ensureUserRow(user.id, entry);
  } catch (err) {
    console.error("Could not create users row", { userId: user.id, err });
    await supabase.auth.signOut();
    return loginWithError("server");
  }

  return NextResponse.redirect(new URL("/", origin));
}
