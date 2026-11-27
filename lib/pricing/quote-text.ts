import type { QuoteResult } from "./types";

// Quote text uses English number formatting, unlike screens (German locale).
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const count = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

const money = (cents: number) => euro.format(cents / 100);

/** "€82.00 – €99.00", or one amount when both ends are equal. */
const range = (lowCents: number, highCents: number) =>
  lowCents === highCents ? money(lowCents) : `${money(lowCents)} – ${money(highCents)}`;

export type QuoteTextOptions = {
  /**
   * When true, uses customer-facing wording (no "indicative / internal").
   * Playground and drafts keep the indicative copy.
   */
  customerFacing?: boolean;
  companyName?: string | null;
  quoteNumber?: string | null;
  validUntil?: string | null;
};

/**
 * Plain-text quote built from the engine output. English number format.
 * Customer-facing mode drops indicative/internal language for PDF / send.
 */
export function quoteText(
  result: QuoteResult,
  productName: string,
  options: QuoteTextOptions = {},
): string {
  const { low, high, delivery, depositPct, paymentDays } = result;
  const batches = delivery.batches;
  const customerFacing = options.customerFacing === true;

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
          batches[0]!.quantity,
        )} units, first delivery in month ${delivery.firstDeliveryMonth} after order.`;

  const title = customerFacing
    ? `Quote: ${productName}, ${count.format(result.quantity)} units`
    : `Indicative quote: ${productName}, ${count.format(result.quantity)} units`;

  const lines: string[] = [];
  if (options.quoteNumber) lines.push(`Quote number: ${options.quoteNumber}`);
  if (options.companyName) lines.push(`Customer: ${options.companyName}`);
  if (lines.length) lines.push("");
  lines.push(title, "");
  lines.push(
    `Unit price: ${range(low.unitPriceCents, high.unitPriceCents)} per unit, excl. VAT`,
    `Total: ${range(low.totalCents, high.totalCents)}`,
  );
  if (result.surchargePct > 0) {
    lines.push(
      `The unit price includes a ${percent.format(result.surchargePct)}% surcharge for the payment terms.`,
    );
  }
  lines.push(payment, deliveryLine, "");

  if (customerFacing) {
    const validity =
      options.validUntil != null
        ? `This quote is valid until ${formatIsoDate(options.validUntil)} (${count.format(result.validityDays)} days from issue).`
        : `This quote is valid for ${count.format(result.validityDays)} days.`;
    lines.push(
      validity,
      "Prices are excl. VAT. Component market prices may affect the final order confirmation.",
    );
  } else {
    lines.push(
      `This indicative quote is valid for ${count.format(result.validityDays)} days. The final price depends on component prices at the time of order.`,
    );
  }
  return lines.join("\n");
}

/** Formats YYYY-MM-DD as DD.MM.YYYY for quote copy. */
function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
