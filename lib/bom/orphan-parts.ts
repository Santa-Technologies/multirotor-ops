/**
 * Returns part ids that appear in candidates and are not in stillUsed.
 * Dedupes candidates so a part listed twice is only returned once.
 */
export function selectOrphanPartIds(
  candidatePartIds: string[],
  stillUsed: Set<string>,
): string[] {
  const unique = [...new Set(candidatePartIds)];
  return unique.filter((id) => !stillUsed.has(id));
}
