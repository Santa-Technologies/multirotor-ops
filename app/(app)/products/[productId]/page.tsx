import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { bomVersionIsDeletable } from "@/lib/bom/delete-bom";
import { getVariantDetail } from "@/lib/products/queries";

import { BomImportForm } from "../bom-import-form";
import { DeleteBomButton } from "../delete-bom-button";

type Props = { params: Promise<{ productId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId } = await params;
  const detail = await getVariantDetail(productId);
  return { title: detail?.product.name ?? "Variant" };
}

export default async function ProductVariantPage({ params }: Props) {
  const user = await requireUser();
  const { productId } = await params;
  const detail = await getVariantDetail(productId);
  if (!detail) notFound();

  const canImport = canWrite(user.role, "bom_versions", "insert");
  const canDelete = canWrite(user.role, "bom_versions", "delete");
  const { product, line, currentBom, lines, versions } = detail;
  const deletable = currentBom
    ? await bomVersionIsDeletable(currentBom.id)
    : false;

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/products" className="underline-offset-4 hover:underline">
            Products
          </Link>
          {" / "}
          {line.name}
        </p>
        <h1 className="mt-1 text-xl font-semibold">{product.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Variant {product.variantLabel} · {product.pricingMode}
          {product.sku ? ` · SKU ${product.sku}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          Current BOM
          {currentBom ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · version {currentBom.version}
              {currentBom.isCurrent ? " (current)" : ""}
            </span>
          ) : null}
        </h2>
        {!currentBom || lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {currentBom
              ? `BOM version ${currentBom.version} has no lines. Re-import or delete it.`
              : "No BOM imported yet."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">MPN</th>
                  <th className="px-3 py-2 font-medium">Manufacturer</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Designators</th>
                  <th className="px-3 py-2 font-medium">Sourcing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-xs">{row.part.mpn}</td>
                    <td className="px-3 py-2">{row.part.manufacturer ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.qtyPerBoard}</td>
                    <td className="px-3 py-2">{row.designators ?? "—"}</td>
                    <td className="px-3 py-2">{row.sourcing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {versions.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Versions: {versions.map((v) => v.version).join(", ")}
          </p>
        ) : null}
        {canDelete && currentBom ? (
          <DeleteBomButton
            bomVersionId={currentBom.id}
            versionLabel={currentBom.version}
            deletable={deletable}
          />
        ) : null}
      </div>

      {canImport ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Import BOM (CSV)</h2>
          <p className="text-xs text-muted-foreground">
            Re-importing the same version label replaces that BOM when it has no
            cost runs. Shared parts stay.
          </p>
          <BomImportForm productId={product.id} />
        </div>
      ) : null}
    </section>
  );
}
