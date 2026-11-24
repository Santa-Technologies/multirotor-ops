import { WEEKS_PER_MONTH } from "./defaults";
import type { DeliveryPlan } from "./types";

/**
 * Delivery plan: batches = ceil(qty ÷ monthly capacity), first delivery month
 * = ceil(lead weeks ÷ 4.345), and batch i (counted from 0) ships in month
 * first + i. Every batch is full except possibly the last.
 */
export function deliveryPlan(
  quantity: number,
  monthlyCapacity: number,
  leadWeeks: number,
): DeliveryPlan {
  if (monthlyCapacity <= 0) throw new RangeError("Monthly capacity must be positive.");
  const count = Math.ceil(quantity / monthlyCapacity);
  // Rounded first so 12 weeks is month 3, not month 4 through float noise.
  const firstDeliveryMonth = Math.ceil(
    Math.round((leadWeeks / WEEKS_PER_MONTH) * 1e9) / 1e9,
  );

  const batches = Array.from({ length: count }, (_, index) => ({
    index,
    month: firstDeliveryMonth + index,
    quantity:
      index < count - 1 ? monthlyCapacity : quantity - monthlyCapacity * (count - 1),
  }));
  return { batches, firstDeliveryMonth };
}
