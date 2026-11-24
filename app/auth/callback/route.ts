import { NextResponse, type NextRequest } from "next/server";

import { parseEmailLinkParams } from "@/lib/auth/email-link";

/**
 * Landing URL of the magic link (the `emailRedirectTo` Supabase allowlists).
 * It never verifies anything on GET: email security scanners open links
 * before the user does, and verifying here would use up the one-time token.
 * Valid links are forwarded to /auth/confirm, where the user clicks to sign in.
 */
export function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const link = parseEmailLinkParams(searchParams);

  if (link.kind === "invalid") {
    // Supabase appends error_code (e.g. otp_expired) when its own /verify step failed.
    console.warn("Magic link without usable parameters", {
      errorCode: searchParams.get("error_code"),
      type: searchParams.get("type"),
    });
    return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  }

  const confirm = new URL("/auth/confirm", origin);
  if (link.kind === "token_hash") {
    confirm.searchParams.set("token_hash", link.tokenHash);
    confirm.searchParams.set("type", link.type);
  } else {
    confirm.searchParams.set("code", link.code);
  }
  return NextResponse.redirect(confirm);
}
