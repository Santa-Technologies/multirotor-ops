import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
};
const ensureUserRow = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));
vi.mock("@/lib/auth/sync-user", () => ({ ensureUserRow }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect ${url}`);
  }
}

const { confirmSignIn } = await import("./actions");

/** Submits the confirm form and returns where the action redirected to. */
async function submit(fields: Record<string, string>): Promise<string> {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  try {
    await confirmSignIn(data);
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

const signedInAs = (email: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email } } });

describe("confirmSignIn", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAILS", "justus@kern.example:admin");
    Object.values(auth).forEach((fn) => fn.mockReset());
    ensureUserRow.mockReset();
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies the token hash and signs in an allowlisted user", async () => {
    signedInAs("justus@kern.example");

    const target = await submit({ token_hash: "abc", type: "email" });

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(ensureUserRow).toHaveBeenCalledWith("user-1", {
      email: "justus@kern.example",
      role: "admin",
    });
    expect(target).toBe("/");
  });

  it("passes the magiclink type through unchanged", async () => {
    signedInAs("justus@kern.example");

    await submit({ token_hash: "abc", type: "magiclink" });

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "magiclink" });
  });

  it("still accepts a legacy PKCE code", async () => {
    signedInAs("justus@kern.example");

    const target = await submit({ code: "xyz" });

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(target).toBe("/");
  });

  it("shows link_invalid when Supabase rejects the token", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", status: 403 },
    });

    const target = await submit({ token_hash: "used", type: "email" });

    expect(target).toBe("/login?error=link_invalid");
    expect(ensureUserRow).not.toHaveBeenCalled();
  });

  it("signs out and rejects a verified user who is not on the allowlist", async () => {
    signedInAs("intruder@example.com");

    const target = await submit({ token_hash: "abc", type: "email" });

    expect(auth.signOut).toHaveBeenCalled();
    expect(ensureUserRow).not.toHaveBeenCalled();
    expect(target).toBe("/login?error=not_allowed");
  });

  it("refuses non-sign-in OTP types without calling Supabase", async () => {
    const target = await submit({ token_hash: "abc", type: "recovery" });

    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(target).toBe("/login?error=link_invalid");
  });
});
