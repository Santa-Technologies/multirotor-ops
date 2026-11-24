"use server";

import { redirect } from "next/navigation";

import { findAllowedEntry, normalizeEmail } from "@/lib/auth/allowlist";
import { ensureUserRow } from "@/lib/auth/sync-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { NOT_ALLOWED_MESSAGE, type LoginState } from "./login-state";

/** Maps Supabase sign-in error codes to plain messages; unknown codes get a generic one. */
function signInErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "This account is not confirmed yet. Ask Justus to confirm it in Supabase.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    default:
      return "Sign-in failed. Try again or tell Justus.";
  }
}

/**
 * Signs in with email and password, but only for allowlisted emails. Rejects
 * anyone not on ALLOWED_EMAILS before Supabase is contacted, signs in with
 * Supabase, creates the users row on first login and redirects to the dashboard.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return { status: "error", message: "Enter your email and password.", email };
  }

  // Rejected before any Supabase call, so outsiders cannot even probe passwords.
  const entry = findAllowedEntry(email);
  if (!entry) {
    return { status: "rejected", message: NOT_ALLOWED_MESSAGE, email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error?.code !== "invalid_credentials") {
      console.warn("signInWithPassword failed", {
        code: error?.code,
        status: error?.status,
      });
    }
    return { status: "error", message: signInErrorMessage(error?.code), email };
  }

  try {
    await ensureUserRow(data.user.id, entry);
  } catch (err) {
    console.error("Could not create users row", { userId: data.user.id, err });
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Sign-in failed on our side. Try again or tell Justus.",
      email,
    };
  }

  redirect("/");
}
