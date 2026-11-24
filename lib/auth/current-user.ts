import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the signed-in user's row, or redirects to /login. Validates the
 * session with Supabase Auth, re-checks the allowlist and loads the users row
 * that holds name and role. Cached per request.
 */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) redirect("/login");

  const [row] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);

  // The row is created by the login action; without it the user has no role.
  if (!row) redirect("/login?error=server");

  return row;
});
