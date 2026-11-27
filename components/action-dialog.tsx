"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Top-right page action that opens a form in a modal. Closes only via the
 * dialog chrome; successful submits rely on server revalidation.
 */
export function ActionDialog({
  triggerLabel,
  title,
  description,
  children,
  triggerVariant = "default",
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  triggerVariant?: "default" | "outline" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {typeof children === "function" ? children(close) : children}
      </DialogContent>
    </Dialog>
  );
}
