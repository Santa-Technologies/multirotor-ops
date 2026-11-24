"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn } from "./actions";
import type { LoginState } from "./login-state";

const initialState: LoginState = { status: "idle" };

/** Email and password form; shows sign-in errors inline. */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  const message = state.status === "idle" ? initialError : state.message;
  const describedBy = message ? "login-message" : undefined;

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
          defaultValue={state.status === "idle" ? undefined : state.email}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      {message ? (
        <p id="login-message" className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Forgot your password? Ask Justus to set a new one.
      </p>
    </form>
  );
}
