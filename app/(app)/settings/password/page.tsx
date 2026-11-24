import type { Metadata } from "next";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Change password</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Replace the password Justus gave you with one only you know.
      </p>
      <PasswordForm />
    </section>
  );
}
