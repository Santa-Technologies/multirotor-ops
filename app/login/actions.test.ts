import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithOtp } }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://preview.example.com" }),
}));

const { requestMagicLink } = await import("./actions");
const { NOT_ALLOWED_MESSAGE } = await import("./login-state");

/** Builds the FormData the login form posts. */
function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAILS", "justus@kern.example:admin,nils@kern.example:sales");
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a non-allowlisted email without contacting Supabase", async () => {
    const result = await requestMagicLink(
      { status: "idle" },
      form("intruder@example.com"),
    );

    expect(result).toEqual({
      status: "rejected",
      message: NOT_ALLOWED_MESSAGE,
      email: "intruder@example.com",
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects everyone when ALLOWED_EMAILS is not set", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    const result = await requestMagicLink(
      { status: "idle" },
      form("justus@kern.example"),
    );

    expect(result.status).toBe("rejected");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a magic link to an allowlisted email with the request's callback URL", async () => {
    const result = await requestMagicLink(
      { status: "idle" },
      form(" Justus@Kern.example "),
    );

    expect(result).toEqual({ status: "sent", email: "justus@kern.example" });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "justus@kern.example",
      options: {
        emailRedirectTo: "https://preview.example.com/auth/callback",
        shouldCreateUser: true,
      },
    });
  });

  it("returns an error for an invalid email", async () => {
    const result = await requestMagicLink({ status: "idle" }, form("nope"));

    expect(result.status).toBe("error");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns an error when Supabase fails", async () => {
    signInWithOtp.mockResolvedValue({
      data: {},
      error: { status: 429, code: "over_email_send_rate_limit" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestMagicLink({ status: "idle" }, form("nils@kern.example"));

    expect(result.status).toBe("error");
  });
});
