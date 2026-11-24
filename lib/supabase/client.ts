import { createBrowserClient } from "@supabase/ssr";

/** Creates a Supabase client for Client Components (auth state, storage uploads). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
