/**
 * Log-linear interpolation over quantity tiers:
 * f(q) = f1 + ((ln q − ln q1) / (ln q2 − ln q1)) × (f2 − f1), q1 ≤ q ≤ q2.
 * Quantities outside the tiers use the nearest tier (50 units → 100-unit value).
 */
export function interpolateLogLinear(
  tiers: Record<string, number>,
  quantity: number,
): number {
  const points = Object.entries(tiers)
    .map(([qty, value]) => [Number(qty), value] as const)
    .filter(([qty]) => Number.isFinite(qty) && qty > 0)
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) throw new RangeError("No quantity tiers to interpolate.");

  const [firstQty, firstValue] = points[0];
  if (quantity <= firstQty) return firstValue;
  const [lastQty, lastValue] = points[points.length - 1];
  if (quantity >= lastQty) return lastValue;

  const upper = points.findIndex(([qty]) => qty >= quantity);
  const [q1, f1] = points[upper - 1];
  const [q2, f2] = points[upper];
  return (
    f1 + ((Math.log(quantity) - Math.log(q1)) / (Math.log(q2) - Math.log(q1))) * (f2 - f1)
  );
}
