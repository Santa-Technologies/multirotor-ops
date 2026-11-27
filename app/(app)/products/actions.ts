"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { productLines, products } from "@/db/schema";
import { withActor } from "@/db/with-actor";
import { requireUser } from "@/lib/auth/current-user";
import { canWrite } from "@/lib/auth/permissions";
import { deleteBom } from "@/lib/bom/delete-bom";
import { importBom } from "@/lib/bom/import-bom";
import { parseBomCsv, suggestBomMapping, type BomColumnKey } from "@/lib/bom/parse-csv";

export type ActionState = {
  status: "idle" | "error" | "ok";
  message?: string;
  issues?: string[];
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Creates a product line. Engineering and admin only. */
export async function createProductLine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "product_lines", "insert")) {
    return { status: "error", message: "You cannot create product lines." };
  }

  const name = field(formData, "name");
  if (!name) return { status: "error", message: "Enter a product line name." };

  try {
    await withActor(user.id, async (tx) => {
      await tx.insert(productLines).values({
        name,
        description: field(formData, "description") || null,
      });
    });
  } catch {
    return { status: "error", message: "Could not create the product line. Is the name taken?" };
  }

  revalidatePath("/products");
  return { status: "ok", message: "Product line created." };
}

/** Creates a variant under an existing product line. */
export async function createVariant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "products", "insert")) {
    return { status: "error", message: "You cannot create variants." };
  }

  const productLineId = field(formData, "product_line_id");
  const variantLabel = field(formData, "variant_label") || "Standard";
  const name = field(formData, "name");
  const pricingMode = field(formData, "pricing_mode");

  if (!productLineId || !name) {
    return { status: "error", message: "Product line and display name are required." };
  }
  if (pricingMode !== "cost_plus" && pricingMode !== "list_price") {
    return { status: "error", message: "Choose a pricing mode." };
  }

  let createdId: string;
  try {
    createdId = await withActor(user.id, async (tx) => {
      const [created] = await tx
        .insert(products)
        .values({
          productLineId,
          name,
          variantLabel,
          pricingMode,
          sku: field(formData, "sku") || null,
        })
        .returning({ id: products.id });
      return created!.id;
    });
  } catch {
    return {
      status: "error",
      message: "Could not create the variant. Check that the name and label are unique.",
    };
  }

  revalidatePath("/products");
  redirect(`/products/${createdId}`);
}

const MAPPING_KEYS: BomColumnKey[] = [
  "mpn",
  "manufacturer",
  "description",
  "qtyPerBoard",
  "designators",
  "sourcing",
  "alternates",
  "productUrl",
];

/** Deletes one BOM version so the same CSV can be re-imported for that product. */
export async function deleteBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "bom_versions", "delete")) {
    return { status: "error", message: "You cannot delete BOMs." };
  }

  const bomVersionId = field(formData, "bom_version_id");
  if (!bomVersionId) {
    return { status: "error", message: "BOM version is required." };
  }

  try {
    const result = await deleteBom({ bomVersionId, actorId: user.id });
    revalidatePath("/products");
    revalidatePath(`/products/${result.productId}`);
    revalidatePath("/parts");
    return {
      status: "ok",
      message: `Deleted BOM ${result.version} (${result.linesRemoved} lines${
        result.orphansRemoved > 0
          ? `, ${result.orphansRemoved} unused parts removed`
          : ""
      }). You can import the same CSV again.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return { status: "error", message };
  }
}

/** Imports a CSV BOM for a variant, upserting shared parts. */
export async function importBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canWrite(user.role, "bom_versions", "insert")) {
    return { status: "error", message: "You cannot import BOMs." };
  }

  const productId = field(formData, "product_id");
  const version = field(formData, "version");
  const file = formData.get("file");

  if (!productId || !version) {
    return { status: "error", message: "Product and version are required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to import." };
  }
  if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
    return {
      status: "error",
      message: "Save the spreadsheet as CSV and upload that file.",
    };
  }

  const text = await file.text();
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const headers = firstLine.split(/[,\t]/).map((h) => h.trim().replace(/^"|"$/g, ""));
  const suggested = suggestBomMapping(headers);

  const mapping = Object.fromEntries(
    MAPPING_KEYS.map((key) => {
      const override = field(formData, `map_${key}`);
      return [key, override || suggested[key]];
    }),
  ) as Parameters<typeof parseBomCsv>[1];

  const parsed = parseBomCsv(text, mapping);
  const blocking = parsed.issues.filter(
    (i) => i.row === 0 || i.message.startsWith("Missing") || i.message.startsWith("Quantity"),
  );
  if (parsed.rows.length === 0) {
    return {
      status: "error",
      message: "No valid BOM rows found.",
      issues: parsed.issues.map((i) => `Row ${i.row}: ${i.message}`),
    };
  }
  if (blocking.some((i) => i.row === 0)) {
    return {
      status: "error",
      message: blocking[0]!.message,
      issues: parsed.issues.map((i) => `Row ${i.row}: ${i.message}`),
    };
  }

  try {
    const result = await importBom({
      productId,
      version,
      notes: field(formData, "notes") || null,
      rows: parsed.rows,
      actorId: user.id,
    });
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/parts");
    return {
      status: "ok",
      message: `Imported ${result.lineCount} lines into BOM ${version}.`,
      issues:
        parsed.issues.length > 0
          ? parsed.issues.map((i) => `Row ${i.row}: ${i.message}`)
          : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return { status: "error", message };
  }
}
