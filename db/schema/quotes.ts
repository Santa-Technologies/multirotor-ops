import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { auditColumns } from "./columns";
import { costRuns } from "./costs";
import { companies } from "./customers";
import { approvalStatus, quoteStatus } from "./enums";
import { rolePolicies } from "./policies";
import { products } from "./products";
import { requests } from "./requests";
import { users } from "./users";

const pct = () => numeric({ precision: 6, scale: 2, mode: "number" });

export type QuoteSurcharges = {
  /** r_d: surcharge % per 10 points of deposit below the standard deposit. */
  depositRatePct: number;
  /** r_t: surcharge % per 30 days of payment terms after shipment. */
  paymentTermsRatePct: number;
};

/** Calculator defaults per product, editable by admin. */
export const quoteSettings = pgTable(
  "quote_settings",
  {
    ...auditColumns(),
    productId: uuid()
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    // Manual unit cost estimate at the 100-unit tier, used when BOM coverage is below 90%.
    manualCostCents: integer().notNull(),
    // Board quantity → factor applied to the manual cost estimate.
    costFactors: jsonb().$type<Record<string, number>>().notNull(),
    marginPct: pct().notNull(),
    // Approval is required below this margin; not yet set by Justus.
    minMarginPct: pct(),
    floorCents: integer().notNull(),
    stdDepositPct: pct().notNull(),
    surcharges: jsonb().$type<QuoteSurcharges>().notNull(),
    // Monthly cost of capital for the financing cost; not yet set by Justus.
    costOfCapitalPct: pct(),
    savingsPct: pct().notNull(),
    costRiskPct: pct().notNull(),
    leadWeeks: integer().notNull(),
    monthlyCapacity: integer().notNull(),
    validityDays: integer().notNull(),
    adjThresholdPct: pct().notNull(),
    approvalMinDepositPct: pct().notNull(),
    approvalMaxPaymentDays: integer().notNull(),
  },
  (t) => [
    check(
      "quote_settings_money_non_negative",
      sql`${t.manualCostCents} >= 0 and ${t.floorCents} >= 0`,
    ),
    check("quote_settings_capacity_positive", sql`${t.monthlyCapacity} > 0`),
    ...rolePolicies("quote_settings"),
  ],
);

/**
 * Indicative quote. Inputs and outputs are frozen at save so later cost
 * changes never alter a sent quote; editing a sent quote adds a new version.
 */
export const quotes = pgTable(
  "quotes",
  {
    ...auditColumns(),
    number: text().notNull(),
    companyId: uuid().references(() => companies.id, { onDelete: "restrict" }),
    requestId: uuid().references(() => requests.id, { onDelete: "set null" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer().notNull(),
    inputs: jsonb().$type<Record<string, unknown>>().notNull(),
    outputs: jsonb().$type<Record<string, unknown>>().notNull(),
    costRunId: uuid().references(() => costRuns.id, { onDelete: "restrict" }),
    status: quoteStatus().notNull().default("draft"),
    version: integer().notNull().default(1),
    approvalStatus: approvalStatus().notNull().default("not_required"),
    approvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp({ withTimezone: true }),
    validUntil: date(),
    pipedriveDealId: integer(),
  },
  (t) => [
    unique().on(t.number, t.version),
    index().on(t.companyId),
    index().on(t.status),
    check("quotes_number_format", sql`${t.number} ~ '^MR-[0-9]{4}-[0-9]{4}$'`),
    check("quotes_quantity_positive", sql`${t.quantity} > 0`),
    check("quotes_version_positive", sql`${t.version} >= 1`),
    ...rolePolicies("quotes"),
  ],
);
