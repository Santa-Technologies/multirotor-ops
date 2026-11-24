"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestMagicLink } from "./actions";
import type { LoginState } from "./login-state";

const initialState: LoginState = { status: "idle" };

/** Email form that requests a magic link and shows the result inline. */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p className="text-sm" role="status">
        Check <span className="font-medium">{state.email}</span> for a sign-in link. You
        can close this tab.
      </p>
    );
  }

  const message =
    state.status === "rejected" || state.status === "error"
      ? state.message
      : initialError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@company.com"
          defaultValue={"email" in state ? state.email : undefined}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "login-message" : undefined}
        />
      </div>
      {message ? (
        <p id="login-message" className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
