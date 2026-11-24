import type { Metadata } from "next";
import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";
import { NOT_ALLOWED_MESSAGE } from "./login-state";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: NOT_ALLOWED_MESSAGE,
  link_invalid: "The sign-in link is invalid or has expired. Request a new one.",
  server: "Sign-in failed on our side. Try again or tell Justus.",
};

/** Login form with the error passed back from /auth/callback or the proxy, if any. */
async function LoginFormWithError({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  return <LoginForm initialError={errorMessage} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Multirotor Ops</CardTitle>
          <CardDescription>
            Sign in with your Kern email. We send you a one-time link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginForm />}>
            <LoginFormWithError searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
