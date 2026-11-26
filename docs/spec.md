# Multirotor Ops Tool – Spec

26 Nov 2026. Author: Justus Nikolaus.

The working rules below are also enforced for AI agents in [`.cursor/rules/working-rules.mdc`](../.cursor/rules/working-rules.mdc).

## Purpose and users

One internal web app where **Supply (Volker)**, **Demand (Nils)** and **Tech (Marc)** share the same picture of products, parts, cost, stock and customer demand. It replaces scattered Signal/LinkedIn/spreadsheet knowledge for build cost and inventory, and gives Nils a pricing playground fed by real BOM cost.

| User   | Role              | Main jobs in the tool                                                                 |
| ------ | ----------------- | ------------------------------------------------------------------------------------- |
| Nils   | Head of Growth    | Explores indicative prices; sees Pipedrive deals; logs lightweight customer requests  |
| Marc   | CTO / engineering | Maintains product lines, variants and BOMs; reports on requests he owns               |
| Volker | MD / supply       | Parts stock and on-order; assembly/WIP timelines; supplier quotes; flagged parts      |
| Justus | CEO               | Reads the weekly dashboard; later: approves customer-facing quotes when that ships    |

**Near-term success:** build cost and stock reality are visible per product variant; Nils can explore indicative prices from the latest cost run in under 10 minutes; the weekly ops meeting can answer what is assembling, due and on the shelf from the app.

## Feature scope

| Module                         | In near term | What it does                                                                                                                                                          |
| ------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products / variants / BOM      | Yes          | Product lines (Pilot H743, CoPilot Nano/Micro, future ESC, Nano+); variants per line; versioned BOMs; CSV/XLSX import; shared **parts** catalog                      |
| Parts + price/stock automation | Yes          | Octopart/Nexar pull; flags; supplier registry; automated RFQ email when API has no price; LLM parse of supplier offer PDFs with **human confirm** before write         |
| Cost engine                    | Yes          | Cost runs from BOM material prices + assembly estimates; history and coverage flags                                                                                   |
| Pricing playground             | Yes          | Existing calculator (`lib/pricing`) fed by cost runs; save draft scenarios; copy as **indicative / internal** — not a customer send                                   |
| Inventory & assembly           | Yes          | Parts on-hand / on-order; finished goods by variant; assembly lots with qty, status, ETA                                                                              |
| Requests (Marc)                | Yes          | Lightweight in-app work/demand items; owner and status; **optional** link to Pipedrive deal/contact. Not all demand lives in Pipedrive                                |
| Pipedrive import               | Yes          | One-way import/refresh of companies, contacts and deals/pipelines. Tool does not write deal stages back until customer-facing quotes                                  |
| Customers (local)              | Thin         | Enough to attach requests; enriched from Pipedrive                                                                                                                    |
| Dashboard                      | Yes          | Cost freshness, flagged parts, stock/WIP/delivery, Marc’s open work, deal snapshot                                                                                    |
| Customer-facing quote send     | Later        | PDF, approval rules, mark sent, Pipedrive deal update — after playground and inventory. Accounting quote → invoice stays outside until clear buy intent               |
| Signal / LinkedIn intake       | v3           | No automatic import. Pasted customer messages, if stored, remain raw text with **no LLM**                                                                             |

Out of near-term scope: invoicing, payment tracking, a customer-facing portal. Invoicing stays in the accounting tool so invoices are not created without buy intent.

## Tech stack and architecture

| Layer                      | Choice                                                                     |
| -------------------------- | -------------------------------------------------------------------------- |
| App                        | Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui               |
| Database, auth, files      | Supabase in an EU region (Postgres, auth, storage)                         |
| ORM and migrations         | Drizzle                                                                    |
| Hosting and scheduled jobs | Vercel, Vercel Cron                                                        |
| Charts and PDF             | Recharts; react-pdf when customer-facing quotes ship                       |
| Email                      | Resend (outbound RFQs and digests; inbound mailbox for supplier replies)   |
| Supplier offer parsing     | LLM / document AI on **supplier** PDFs only, always behind human confirm   |
| Tests                      | Vitest (logic), Playwright (pricing playground / later quote flow)         |

Pricing playground and cost runs never call a distributor live: prices enter through the weekly (or manual) cost run and confirmed supplier offers.

Auth today: email + password, restricted to `ALLOWED_EMAILS`; roles in `users.role`.

## Data model

Postgres tables, all with `id` (uuid), `created_at`, `updated_at`, `created_by`. Money is euro cents (integers); quantities are integers. Details and deltas: [data-model.md](data-model.md).

**Parts-first shape**

- **product_lines** – Pilot H743, CoPilot Nano, CoPilot Micro, 4-in-1 ESC, …
- **products** (variants) – belong to a line; each has its own current BOM and pricing mode (`cost_plus` / `list_price`)
- **parts** – global MPN/manufacturer row shared across BOMs; one place for price, stock and RFQ state
- **bom_versions** / **bom_lines** – lines reference `part_id` (qty, designators, sourcing, alternates)
- **suppliers** / **rfq_threads** – registry and deduped RFQ per part (phase 7)
- **inventory** – parts on-hand / on-order; finished goods; assembly lots (phase 5)
- **cost_runs** – per variant BOM; tiers and flags
- **quotes** – playground drafts first; customer send later
- **requests** – in-app; optional Pipedrive deal/contact link
- **companies** / **contacts** – local + Pipedrive ids
- Existing: distributors, price_snapshots, manual_quotes, assembly_prices, quote_settings, activity_log, users

## Pricing engine

Unchanged as a pure module: `lib/pricing` with no database access, fully unit-tested. Unit cost comes from the latest cost run (or the manual estimate × factor curve when coverage is low). See [pricing.md](pricing.md).

Customer-facing approval rules and “mark sent” apply only when the send phase ships. Until then, saved rows are **internal scenarios**.

## Price collection

Prices come from APIs and confirmed supplier offers, not website scraping. Each source is an adapter behind one interface.

```ts
interface PriceProvider {
  name: string;
  fetch(mpns: string[]): Promise<PriceResult[]>;
}
```

| Provider                         | Priority | Notes                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------- |
| Nexar (Octopart)                 | First    | Aggregator; approved-distributor / China-free filter still applies    |
| Mouser, Digi-Key, TME, Farnell   | Later    | Add if Octopart gaps hurt                                             |

**Weekly cost run** (cron + “refresh now”): load current BOMs for cost_plus variants → fetch parts from enabled providers → EUR via ECB → cheapest approved offer per tier → direct-quote / confirmed manual offers → assembly → save cost_run and flag gaps.

**Missing API price → RFQ (phase 7):** one outbound email per part (deduped across variants) via Resend → inbound thread on a dedicated mailbox → LLM extract from offer PDF → human confirm → write price/stock. Never auto-write unconfirmed parses. No LLM on customer messages.

## Phases

Phases 0–2 are done. One phase at a time; do not start the next until acceptance criteria pass.

### Phase 0 – Project setup (done)

Next.js app, Supabase, Drizzle, allowlist auth, app shell, docs and working rules, Vercel.

### Phase 1 – Data model and seed (done)

Initial tables, RLS, activity log, Pilot H743 quote_settings seed.

### Phase 2 – Pricing engine (done)

`lib/pricing` pure functions and Vitest reference cases.

### Phase 3 – Parts, product lines, variants, BOM (done)

- `parts`, `product_lines`; products are variants under a line; BOM lines reference `part_id`.
- BOM import (CSV/XLSX) upserts parts and creates a bom_version for a variant.
- UI: product lines → variants → BOM viewer; parts list with “used in”.

**Done when:** Pilot H743 and at least one CoPilot variant share a part without duplicate part rows.

### Phase 4 – Cost run v0 + pricing playground (done)

- Manual/assembly prices + known part prices → cost_run per variant (`lib/costing`).
- Costs page: enter supplier/assembly quotes, run cost, view tiers and flags.
- Quotes page as playground: live calc from `lib/pricing`, warnings, save internal draft; no customer send.

**Done when:** Nils can change qty/terms on Pilot H743 and see prices from the latest cost run in under 10 minutes.

### Phase 5 – Inventory and assembly

- `part_inventory`, `finished_goods`, `assembly_lots` (supply-writable).
- Inventory page: parts stock, FG, open assembly lots with ETA/status.
- Dashboard: stock totals, assembly timeline, Pilot cost freshness, recent drafts.

**Done when:** Weekly review can answer what is assembling, due and on the shelf from the app.

### Phase 6 – Octopart prices + weekly cost automation

- PriceProvider + Nexar/Octopart adapter; snapshots; cron + refresh.
- Cost runs prefer API prices; flags for missing/stale/EOL/low stock.

**Done when:** Unattended run covers at least 90% of current Pilot BOM lines that are distributor-sourced.

### Phase 7 – Supplier RFQ automation (email + PDF)

- Supplier registry; deduped RFQ per part; Resend outbound; inbound thread matching.
- LLM extract → human confirm → write offer.

**Done when:** A missing-price part produces one email, and a confirmed PDF offer updates the part without a second ask for another BOM using the same part.

### Phase 8 – Requests + Pipedrive import + dashboard

- Requests CRUD, Marc owner/status, optional deal/contact link.
- Pipedrive one-way sync: companies, contacts, deals/pipelines.
- Dashboard: Marc’s open requests, deal overview, cost/inventory flags.

**Done when:** Marc can report weekly work from the app; commercial deal overview does not depend on perfect Pipedrive hygiene for tech work items.

### Phase 9 – Later

- Customer-facing quote: PDF, approval, mark sent, Pipedrive deal update.
- Extra distributors if needed; deeper PO workflow; large-order playbook.
- v3: Signal/LinkedIn intake (still no LLM on customer text unless revisited).

## Working rules

- Work one phase at a time; list the files you will touch before writing code.
- The pricing engine is the source of truth: never duplicate pricing math in UI components.
- Every schema change goes through a migration; never edit the database by hand.
- Money in integer cents, EUR only in the database; convert at the edge.
- Price snapshots and sent quotes are immutable; changes create new rows or versions.
- Every external API call goes through an adapter with timeouts, retries and logged errors; no API keys in code.
- Write Vitest tests for all business logic and Playwright tests for the pricing playground / later quote flow.
- Keep UI copy plain and in English; dates as DD.MM.YYYY, numbers in German locale on screens, English locale in quote text.
- When an API's behaviour is unclear, stop and ask instead of guessing field names.
- No LLM processing of **customer** messages. LLM on **supplier** offer documents is allowed, only after human confirm before any price/stock write.
- Approved distributors: China-free, EU when that is the best offer.
- Pricing playground copy must stay clearly indicative / internal until customer-facing send exists.

## Open decisions

Decided 24–26 Nov 2026:

- Hosting and data location: Supabase EU region and Vercel. Acceptable for defence-related customer data.
- Who owns the tool after launch: Justus.
- Approved distributors: China-free, best case EU only.
- LLM on customer messages: no. LLM on supplier offer PDFs: yes, with human confirm.
- Pipedrive: one-way import of contacts and deals; write-back waits for customer-facing quotes.
- API pricing: Octopart/Nexar first.
- Inventory and assembly timelines are in near-term scope (ahead of customer-facing quote send).
- Inbound RFQ mailbox: Resend Inbound or equivalent; exact provider verified in phase 7.
