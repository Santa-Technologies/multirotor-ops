"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

import { changePassword } from "./actions";
import type { PasswordState } from "./password-state";

const initialState: PasswordState = { status: "idle" };

const FIELDS = [
  {
    name: "current_password",
    label: "Current password",
    autoComplete: "current-password",
  },
  { name: "new_password", label: "New password", autoComplete: "new-password" },
  {
    name: "confirm_password",
    label: "Repeat new password",
    autoComplete: "new-password",
  },
] as const;

/** Form to replace the password Justus set with one only the user knows. */
export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      {FIELDS.map((field) => (
        <div key={field.name} className="flex flex-col gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type="password"
            autoComplete={field.autoComplete}
            required
            minLength={
              field.name === "current_password" ? undefined : MIN_PASSWORD_LENGTH
            }
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        At least {MIN_PASSWORD_LENGTH} characters. A password manager helps.
      </p>
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert" id="password-message">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" ? (
        <p className="text-sm" role="status" id="password-message">
          Password changed. Use the new password next time you sign in.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
