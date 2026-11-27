import { describeDbError } from "@/lib/db-error";

/** Message when an existing BOM version has cost runs and cannot be replaced. */
export function bomVersionBlockedByCostRunsMessage(version: string): string {
  return `BOM version "${version}" already exists and has cost runs. Import under a new version label, or remove the cost runs first.`;
}

/** Fallback when a (product, version) unique conflict still reaches the action. */
export function bomVersionAlreadyExistsMessage(version: string): string {
  return `BOM version "${version}" already exists for this product. Delete that BOM first, or use a new version label.`;
}

/** True when Postgres reports the bom_versions (product_id, version) unique key. */
export function isBomVersionUniqueViolation(error: unknown): boolean {
  const summary = describeDbError(error);
  if (summary.code !== "23505") return false;
  if (summary.constraint === "bom_versions_productId_version_unique") return true;
  return (
    summary.constraint?.includes("bom_versions") === true ||
    summary.message.toLowerCase().includes("bom_versions")
  );
}
