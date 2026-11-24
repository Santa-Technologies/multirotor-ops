import { pgEnum } from "drizzle-orm/pg-core";

import { ROLES } from "@/lib/auth/allowlist";

export const userRole = pgEnum("user_role", ROLES);

export const pricingMode = pgEnum("pricing_mode", ["cost_plus", "list_price"]);

export const sourceChannel = pgEnum("source_channel", [
  "linkedin",
  "signal",
  "email",
  "trade_fair",
]);

export const requestType = pgEnum("request_type", [
  "feature",
  "custom_variant",
  "quote",
  "integration_issue",
  "bug",
  "other",
]);

// The spec names urgency but not its values.
export const requestUrgency = pgEnum("request_urgency", ["low", "normal", "high"]);

export const requestStatus = pgEnum("request_status", [
  "new",
  "triaged",
  "accepted",
  "planned",
  "declined",
  "done",
]);

// The spec names requirement status but not its values.
export const requirementStatus = pgEnum("requirement_status", [
  "open",
  "planned",
  "done",
  "declined",
]);

export const bomSourcing = pgEnum("bom_sourcing", ["distributor", "direct_quote"]);

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "expired",
  "lost",
]);

export const approvalStatus = pgEnum("approval_status", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);

export const activityAction = pgEnum("activity_action", ["insert", "update", "delete"]);
