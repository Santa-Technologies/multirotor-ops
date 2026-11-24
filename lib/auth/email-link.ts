import type { EmailOtpType } from "@supabase/supabase-js";

// Supabase's docs use `email` for magic-link token hashes; `magiclink` is the
// older name for the same thing. Other OTP types (recovery, invite,
// email_change) are not part of this app's sign-in and are refused.
const SIGN_IN_TYPES = ["email", "magiclink"] as const satisfies readonly EmailOtpType[];
export type SignInOtpType = (typeof SIGN_IN_TYPES)[number];

export type EmailLinkParams =
  | { kind: "token_hash"; tokenHash: string; type: SignInOtpType }
  | { kind: "code"; code: string }
  | { kind: "invalid" };

function isSignInType(value: string | null): value is SignInOtpType {
  return value !== null && (SIGN_IN_TYPES as readonly string[]).includes(value);
}

/**
 * Reads the sign-in parameters from a magic-link URL. Prefers `token_hash` +
 * `type` (custom email template); falls back to the PKCE `code` that the
 * default Supabase template produces.
 */
export function parseEmailLinkParams(params: URLSearchParams): EmailLinkParams {
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && isSignInType(type)) return { kind: "token_hash", tokenHash, type };

  const code = params.get("code");
  if (code) return { kind: "code", code };

  return { kind: "invalid" };
}
