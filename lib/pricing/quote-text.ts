import type { QuoteResult } from "./types";

// Quote text uses English number formatting, unlike screens (German locale).
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const count = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

const money = (cents: number) => euro.format(cents / 100);

/** "€82.00 – €99.00", or one amount when both ends are equal. */
const range = (lowCents: number, highCents: number) =>
  lowCents === highCents ? money(lowCents) : `${money(lowCents)} – ${money(highCents)}`;

/**
 * Plain-text indicative quote built from the engine output. PROVISIONAL
 * wording: the existing calculator's text was not available, so this follows
 * the spec's outputs and must be aligned with the calculator before go-live.
 */
export function quoteText(result: QuoteResult, productName: string): string {
  const { low, high, delivery, depositPct, paymentDays } = result;
  const batches = delivery.batches;

  const balance =
    paymentDays === 0
      ? "on delivery"
      : `${count.format(paymentDays)} days after shipment`;
  const payment =
    depositPct === 0
      ? `Payment: no deposit, full amount ${balance}.`
      : `Payment: ${percent.format(depositPct)}% deposit on order (${range(
          result.deposit.lowCents,
          result.deposit.highCents,
        )}), balance ${balance}.`;

  const deliveryLine =
    batches.length === 1
      ? `Delivery: one batch in month ${delivery.firstDeliveryMonth} after order.`
      : `Delivery: ${batches.length} monthly batches of up to ${count.format(
          batches[0].quantity,
        )} units, first delivery in month ${delivery.firstDeliveryMonth} after order.`;

  const lines = [
    `Indicative quote: ${productName}, ${count.format(result.quantity)} units`,
    "",
    `Unit price: ${range(low.unitPriceCents, high.unitPriceCents)} per unit, excl. VAT`,
    `Total: ${range(low.totalCents, high.totalCents)}`,
  ];
  if (result.surchargePct > 0) {
    lines.push(
      `The unit price includes a ${percent.format(result.surchargePct)}% surcharge for the payment terms.`,
    );
  }
  lines.push(
    payment,
    deliveryLine,
    "",
    `This indicative quote is valid for ${count.format(result.validityDays)} days. The final price depends on component prices at the time of order.`,
  );
  return lines.join("\n");
}
