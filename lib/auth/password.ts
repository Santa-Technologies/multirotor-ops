// Stricter than Supabase's default minimum of 6. Set the same minimum under
// Authentication → Sign In / Providers → Email so the server enforces it too.
export const MIN_PASSWORD_LENGTH = 12;

/** Returns an error message when a new password breaks the app's rules, otherwise null. */
export function validateNewPassword(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmation) return "The two new passwords do not match.";
  return null;
}
