"use server";

import { requireUser } from "@/lib/auth/current-user";
import { validateNewPassword } from "@/lib/auth/password";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PasswordState } from "./password-state";

/** Maps Supabase password-update error codes to plain messages. */
function updateErrorMessage(code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return "Supabase rejected this password as too weak. Choose a longer or less common one.";
    case "same_password":
      return "The new password must be different from the current one.";
    case "reauthentication_needed":
      return "Supabase requires email reauthentication for password changes. Ask Justus to turn off “Secure password change”.";
    default:
      return "Could not change the password. Try again or tell Justus.";
  }
}

/**
 * Changes the signed-in user's password. Checks the session, validates the
 * new password, re-checks the current password with Supabase (so an
 * unattended open session cannot change it), then updates it.
 */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const current = field("current_password");
  const next = field("new_password");

  if (!current) return { status: "error", message: "Enter your current password." };
  const invalid = validateNewPassword(next, field("confirm_password"));
  if (invalid) return { status: "error", message: invalid };

  const supabase = await createSupabaseServerClient();

  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (checkError) {
    return {
      status: "error",
      message:
        checkError.code === "invalid_credentials"
          ? "Your current password is wrong."
          : updateErrorMessage(checkError.code),
    };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    console.warn("updateUser password failed", {
      code: error.code,
      status: error.status,
    });
    return { status: "error", message: updateErrorMessage(error.code) };
  }

  return { status: "saved" };
}
