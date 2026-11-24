"use server";

import { headers } from "next/headers";

import { isEmailAllowed, normalizeEmail } from "@/lib/auth/allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { NOT_ALLOWED_MESSAGE, type LoginState } from "./login-state";

/** Builds the absolute callback URL from the incoming request, so preview deployments get their own URL. */
async function callbackUrl(): Promise<string> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return `${origin}/auth/callback`;
}

/**
 * Sends a magic link, but only to allowlisted emails. Validates the email,
 * rejects anyone not on ALLOWED_EMAILS before Supabase is contacted, then asks
 * Supabase to email a link that returns to /auth/callback.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? normalizeEmail(raw) : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address.", email };
  }

  // Rejected before any Supabase call: no auth user is created and no email is sent.
  if (!isEmailAllowed(email)) {
    return { status: "rejected", message: NOT_ALLOWED_MESSAGE, email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(), shouldCreateUser: true },
  });

  if (error) {
    console.error("signInWithOtp failed", { status: error.status, code: error.code });
    return {
      status: "error",
      message: "Could not send the sign-in link. Try again in a minute.",
      email,
    };
  }

  return { status: "sent", email };
}
