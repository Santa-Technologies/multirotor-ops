import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/current-user";
import { listPartsWithUsage } from "@/lib/products/queries";

export const metadata: Metadata = { title: "Parts" };

export default async function PartsPage() {
  await requireUser();
  const rows = await listPartsWithUsage();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Parts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared catalog across all BOMs.{" "}
          <Link href="/products" className="underline-offset-4 hover:underline">
            Back to products
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No parts yet. Import a BOM on a variant to create them.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">MPN</th>
                <th className="px-3 py-2 font-medium">Manufacturer</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Used in</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ part, usedIn }) => (
                <tr key={part.id}>
                  <td className="px-3 py-2 font-mono text-xs">{part.mpn}</td>
                  <td className="px-3 py-2">{part.manufacturer ?? "—"}</td>
                  <td className="px-3 py-2">{part.description ?? "—"}</td>
                  <td className="px-3 py-2">
                    {usedIn.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      usedIn.join(", ")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
