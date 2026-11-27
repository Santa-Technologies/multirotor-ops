/**
 * Returns part IDs that appear only in the candidate set and nowhere in the
 * remaining usage sets (other BOM lines, inventory, RFQ, part_suppliers).
 */
export function selectOrphanPartIds(
  candidatePartIds: string[],
  stillUsed: ReadonlySet<string>,
): string[] {
  const unique = [...new Set(candidatePartIds)];
  return unique.filter((id) => !stillUsed.has(id));
}
