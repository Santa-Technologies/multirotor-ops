import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/auth/allowlist";
import { getSupabasePublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/api/cron"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie and gates every page. Validates the
 * user with Supabase Auth, signs out sessions whose email is not on the
 * allowlist, and redirects anonymous visitors to /login.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run before any other logic so a refreshed token is written to the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /** Redirects while keeping any auth cookies the client wrote to `response`. */
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") redirect.headers.set(key, value);
    });
    return redirect;
  };

  // An allowlist entry can be removed after someone logged in; their session ends on the next request.
  if (user && !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    return redirectTo("/login?error=not_allowed");
  }

  if (!user && !isPublicPath(pathname)) {
    return redirectTo("/login");
  }

  if (user && pathname === "/login") {
    return redirectTo("/");
  }

  return response;
}
