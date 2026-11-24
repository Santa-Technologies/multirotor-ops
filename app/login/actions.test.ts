import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { signInWithPassword: vi.fn(), signOut: vi.fn() };
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

const { signIn } = await import("./actions");
const { NOT_ALLOWED_MESSAGE } = await import("./login-state");

/** Submits the login form; returns the state, or the redirect target on success. */
async function submit(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  try {
    return await signIn({ status: "idle" }, data);
  } catch (err) {
    if (err instanceof RedirectSignal) return { redirectedTo: err.url };
    throw err;
  }
}

describe("signIn", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAILS", "justus@kern.example:admin,nils@kern.example:sales");
    auth.signInWithPassword.mockReset();
    auth.signOut.mockReset();
    ensureUserRow.mockReset();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email: "justus@kern.example" } },
      error: null,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a non-allowlisted email without contacting Supabase", async () => {
    const result = await submit("intruder@example.com", "correct horse battery");

    expect(result).toEqual({
      status: "rejected",
      message: NOT_ALLOWED_MESSAGE,
      email: "intruder@example.com",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects everyone when ALLOWED_EMAILS is not set", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    const result = await submit("justus@kern.example", "correct horse battery");

    expect(result).toMatchObject({ status: "rejected" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in an allowlisted user, seeds the role and redirects to the dashboard", async () => {
    const result = await submit(" Justus@Kern.example ", "correct horse battery");

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "justus@kern.example",
      password: "correct horse battery",
    });
    expect(ensureUserRow).toHaveBeenCalledWith("user-1", {
      email: "justus@kern.example",
      role: "admin",
    });
    expect(result).toEqual({ redirectedTo: "/" });
  });

  it("shows a plain message for a wrong password", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", status: 400 },
    });

    const result = await submit("nils@kern.example", "wrong");

    expect(result).toMatchObject({
      status: "error",
      message: "Wrong email or password.",
    });
    expect(ensureUserRow).not.toHaveBeenCalled();
  });

  it("explains an unconfirmed account", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", status: 400 },
    });

    const result = await submit("nils@kern.example", "whatever-password");

    expect(result).toMatchObject({ status: "error" });
    expect((result as { message: string }).message).toContain("not confirmed");
  });

  it("requires both email and password", async () => {
    const result = await submit("nils@kern.example", "");

    expect(result).toMatchObject({ status: "error" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs out again when the users row cannot be created", async () => {
    ensureUserRow.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await submit("justus@kern.example", "correct horse battery");

    expect(auth.signOut).toHaveBeenCalled();
    expect(result).toMatchObject({ status: "error" });
  });
});
