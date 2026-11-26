import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { listProductLinesWithVariants } from "@/lib/products/queries";

import { CreateLineForm } from "./create-line-form";
import { CreateVariantForm } from "./create-variant-form";

export const metadata: Metadata = { title: "Products & BOM" };

export default async function ProductsPage() {
  const user = await requireUser();
  const lines = await listProductLinesWithVariants();
  const canEdit = canWrite(user.role, "product_lines", "insert");

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Products & BOM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product lines, variants and shared parts.{" "}
          <Link href="/parts" className="underline-offset-4 hover:underline">
            Open parts catalog
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Lines and variants</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product lines yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {lines.map((line) => (
              <li key={line.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {line.active ? "Active" : "Inactive"}
                  </span>
                </div>
                {line.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{line.description}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {line.variants.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No variants yet.</li>
                  ) : (
                    line.variants.map((variant) => (
                      <li key={variant.id}>
                        <Link
                          href={`/products/${variant.id}`}
                          className="text-sm underline-offset-4 hover:underline"
                        >
                          {variant.name}
                          <span className="text-muted-foreground">
                            {" "}
                            · {variant.variantLabel} · {variant.pricingMode}
                          </span>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Add product line</h2>
            <CreateLineForm />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Add variant</h2>
            <CreateVariantForm lines={lines.map((l) => ({ id: l.id, name: l.name }))} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
