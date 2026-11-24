import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

const { GET } = await import("./route");

/** Calls the route and returns the redirect target. */
function call(query: string) {
  const response = GET(new NextRequest(`https://ops.example.com/auth/callback?${query}`));
  return new URL(response.headers.get("location") ?? "");
}

describe("GET /auth/callback", () => {
  it("forwards a token_hash link to the confirm page without verifying it", () => {
    const target = call("token_hash=abc&type=email");

    expect(target.pathname).toBe("/auth/confirm");
    expect(target.searchParams.get("token_hash")).toBe("abc");
    expect(target.searchParams.get("type")).toBe("email");
    // A mail scanner opening the link must not use up the one-time token.
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("forwards a legacy PKCE code to the confirm page", () => {
    const target = call("code=xyz");

    expect(target.pathname).toBe("/auth/confirm");
    expect(target.searchParams.get("code")).toBe("xyz");
  });

  it("sends links without usable parameters to the login error", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const target = call("error=access_denied&error_code=otp_expired");

    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("error")).toBe("link_invalid");
  });
});
