import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { signInWithPassword: vi.fn(), updateUser: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: async () => ({ id: "user-1", email: "nils@kern.example", role: "sales" }),
}));

const { changePassword } = await import("./actions");

/** Submits the change-password form with the given fields. */
function submit(current: string, next: string, confirm = next) {
  const data = new FormData();
  data.set("current_password", current);
  data.set("new_password", next);
  data.set("confirm_password", confirm);
  return changePassword({ status: "idle" }, data);
}

describe("changePassword", () => {
  beforeEach(() => {
    auth.signInWithPassword.mockReset();
    auth.updateUser.mockReset();
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("checks the current password, then updates to the new one", async () => {
    const result = await submit("one-time-from-justus", "a much longer secret");

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "nils@kern.example",
      password: "one-time-from-justus",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a much longer secret" });
    expect(result).toEqual({ status: "saved" });
  });

  it("refuses when the current password is wrong", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", status: 400 },
    });

    const result = await submit("wrong", "a much longer secret");

    expect(result).toEqual({
      status: "error",
      message: "Your current password is wrong.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses short or mismatched new passwords without calling Supabase", async () => {
    expect((await submit("current", "short")).status).toBe("error");
    expect(
      (await submit("current", "a much longer secret", "different one!!")).status,
    ).toBe("error");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("explains a password Supabase rejects as weak", async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: "weak_password", status: 422 },
    });

    const result = await submit("current", "aaaaaaaaaaaa");

    expect(result).toMatchObject({ status: "error" });
    expect((result as { message: string }).message).toContain("too weak");
  });
});
