export type PasswordState =
  { status: "idle" } | { status: "saved" } | { status: "error"; message: string };
