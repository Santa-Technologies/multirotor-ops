import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseEmailLinkParams } from "@/lib/auth/email-link";

import { confirmSignIn } from "./actions";

export const metadata: Metadata = { title: "Confirm sign-in" };

/** Button that posts the link parameters, or a hint when the link is unusable. */
async function ConfirmForm({
  searchParams,
}: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const link = parseEmailLinkParams(params);

  if (link.kind === "invalid") {
    return (
      <p className="text-sm text-destructive" role="alert">
        This sign-in link is incomplete.{" "}
        <Link href="/login" className="underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={confirmSignIn} className="flex flex-col gap-4">
      {link.kind === "token_hash" ? (
        <>
          <input type="hidden" name="token_hash" value={link.tokenHash} />
          <input type="hidden" name="type" value={link.type} />
        </>
      ) : (
        <input type="hidden" name="code" value={link.code} />
      )}
      <Button type="submit">Continue signing in</Button>
    </form>
  );
}

export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Multirotor Ops</CardTitle>
          <CardDescription>
            Click the button to finish signing in. The link works once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Button disabled>Continue signing in</Button>}>
            <ConfirmForm searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
