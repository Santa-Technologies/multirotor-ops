export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "rejected"; message: string; email: string }
  | { status: "error"; message: string; email: string };

export const NOT_ALLOWED_MESSAGE =
  "This email is not allowed to sign in. Ask Justus to add it.";
