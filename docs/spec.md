# Multirotor Ops Tool – Spec

24 Nov 2026. Author: Justus Nikolaus.

The working rules below are also enforced for AI agents in [`.cursor/rules/working-rules.mdc`](../.cursor/rules/working-rules.mdc).

## Purpose and users

One internal web app that replaces Signal threads and LinkedIn DMs as the place where customer requests, component prices and quotes live. It solves three problems: product requirements are not stored anywhere, nobody knows what the Pilot H743 currently costs to build, and large-volume quotes take days or never get answered.

| User   | Role              | Main jobs in the tool                                                   |
| ------ | ----------------- | ----------------------------------------------------------------------- |
| Nils   | Head of Growth    | Logs customer requests, creates and sends indicative quotes             |
| Marc   | CTO / engineering | Triages requests, maintains BOMs, links requests to roadmap items       |
| Volker | MD / supply       | Enters manual supplier quotes and assembly prices, checks flagged parts |
| Justus | CEO               | Approves quotes below floor or with unusual terms, reads the dashboard  |

Success after 8 weeks: every customer request from the last 30 days is in the tool, the Pilot H743 cost per volume tier is never older than 7 days, and an indicative quote for any quantity takes Nils under 10 minutes without asking anyone.

## Feature scope

The tool has six modules. Requests, BOM costing and quotes are the core; customers and the dashboard tie them together.

| Module                    | What it does                                                              | Key features                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers                 | One record per company and contact                                        | Company, contacts, country, channel (LinkedIn, Signal, email, trade fair), linked requests and quotes; two-way Pipedrive sync in v1, Pipedrive stays the CRM                                                                                             |
| Requests (feedback inbox) | Every customer requirement, feature wish, custom variant or quote request | Quick-add form with the original LinkedIn or Signal message pasted in as raw text; type, product, quantity, urgency, status, owner; link several requests to one requirement so demand is counted; weekly triage view for Marc                           |
| Products and BOM          | Product master and versioned BOMs                                         | Products (Pilot H743, Kern Nano, Kern Nano Plus); BOM import from CSV/XLSX; line items with MPN, manufacturer, qty per board, designators, alternates, "direct quote only" flag                                                                          |
| Cost engine               | Current cost per unit per volume tier                                     | Price snapshots from distributor APIs (weekly job); manual supplier and assembler quotes with date and expiry; BOM cost per tier with source per line; flags for missing price, low stock, long lead time, end-of-life, stale manual quote; cost history |
| Quotes                    | Indicative quotes for any quantity                                        | Calculator as already built, reading the live cost; saved and versioned; statuses draft, sent, accepted, expired, lost; approval by Justus below floor or above set discount; quote text and PDF export; link to customer and request                    |
| Dashboard                 | One screen for the weekly ops meeting                                     | Open requests by status, quotes pipeline and value, Pilot H743 cost trend, flagged parts, stale prices                                                                                                                                                   |

Out of scope for v1: inventory and order tracking, invoicing, payment tracking, a customer-facing portal, and pricing for Kern products (they keep list price with volume discounts; the tool only stores their price list). Inventory can follow in v2 once the data model is stable.

## Tech stack and architecture

A standard TypeScript stack that one person can maintain. All choices are defaults; swap any of them before phase 0, not after.

| Layer                      | Choice                                                        |
| -------------------------- | ------------------------------------------------------------- |
| App                        | Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui  |
| Database, auth, files      | Supabase in an EU region (Postgres, magic-link auth, storage) |
| ORM and migrations         | Drizzle                                                       |
| Hosting and scheduled jobs | Vercel, Vercel Cron                                           |
| Charts and PDF             | Recharts; react-pdf for quote PDFs                            |
| Email                      | Resend                                                        |
| Tests                      | Vitest (logic), Playwright (quote flow)                       |

Quotes never call a distributor live: prices enter only through the weekly cost run, so a slow or failing API cannot block Nils.

The source note included an architecture diagram (8 components) that was not pasted as an image. Reconstruct it from this section before phase 0 if the diagram is still required.

## Data model

Postgres tables, all with `id` (uuid), `created_at`, `updated_at`, `created_by`. Money is stored in euro cents as integers; quantities as integers.

| Table           | Key fields                                                                                                                                                                                                                                          | Notes                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| users           | name, email, role (admin, sales, engineering, supply)                                                                                                                                                                                               | Role decides edit rights and approvals                                            |
| companies       | name, country, website, pipedrive_id                                                                                                                                                                                                                | One per customer organisation                                                     |
| contacts        | company_id, name, email, phone, linkedin_url, pipedrive_id                                                                                                                                                                                          |                                                                                   |
| requests        | company_id, contact_id, source_channel, raw_text, type (feature, custom_variant, quote, integration_issue, bug, other), product_id, quantity, urgency, status (new, triaged, accepted, planned, declined, done), owner_id, requirement_id, due_date | raw_text keeps the original message                                               |
| requirements    | title, description, product_id, status, roadmap_ref                                                                                                                                                                                                 | Groups many requests; request count = demand signal                               |
| products        | name, sku, pricing_mode (cost_plus, list_price), active                                                                                                                                                                                             | Pilot H743 = cost_plus; Kern = list_price                                         |
| list_prices     | product_id, min_qty, unit_price_cents                                                                                                                                                                                                               | Only for list_price products                                                      |
| bom_versions    | product_id, version, is_current, notes                                                                                                                                                                                                              | One current version per product                                                   |
| bom_lines       | bom_version_id, mpn, manufacturer, description, qty_per_board, designators, sourcing (distributor, direct_quote), alternates (array of MPN)                                                                                                         |                                                                                   |
| distributors    | name, country, approved (bool), api_provider                                                                                                                                                                                                        | Approved list filters prices, e.g. EU or China-free                               |
| price_snapshots | mpn, distributor_id, fetched_at, currency, price_breaks (jsonb: qty → unit price), stock, factory_lead_days, lifecycle, url                                                                                                                         | Append-only; never overwritten                                                    |
| manual_quotes   | mpn or assembler, supplier, qty, unit_price_cents, quoted_at, valid_until, source_note, entered_by                                                                                                                                                  | Covers direct-quote parts and assembly                                            |
| assembly_prices | assembler, product_id, qty_tier, unit_price_cents, setup_cost_cents, quoted_at, valid_until                                                                                                                                                         |                                                                                   |
| cost_runs       | product_id, bom_version_id, run_at, tiers (jsonb: qty → material, assembly, total), flags (jsonb), coverage_pct                                                                                                                                     | One row per weekly calculation                                                    |
| quote_settings  | product_id, cost_factors (jsonb), margin_pct, floor_cents, std_deposit_pct, surcharges, cost_of_capital_pct, lead_weeks, monthly_capacity, validity_days, adj_threshold_pct                                                                         | Defaults per product, editable by admin                                           |
| quotes          | number (MR-2026-0001), company_id, request_id, product_id, quantity, inputs (jsonb), outputs (jsonb), cost_run_id, status, version, approval_status, approved_by, sent_at, valid_until, pipedrive_deal_id                                           | Inputs and outputs frozen at save, so later cost changes never alter a sent quote |
| activity_log    | entity, entity_id, action, user_id, diff                                                                                                                                                                                                            | Audit trail for every change                                                      |

## Pricing engine

The quote logic is a pure TypeScript module (`lib/pricing`) with no database access, fully unit-tested. It ports the existing calculator; the only change is that unit cost comes from the latest cost run instead of a manual estimate.

**Unit cost at quantity q.** If the cost run has a computed tier at or around q, interpolate log-linearly between the two nearest tiers. If not (BOM coverage below 90%), fall back to the manual estimate times the cost factor curve, and mark the quote "cost estimated".

```
f(q) = f1 + ((ln q - ln q1) / (ln q2 - ln q1)) * (f2 - f1),  q1 <= q <= q2
```

**Cost range.** low = cost × (1 − possible savings %), high = cost × (1 + cost risk %). Defaults: 5% and 15%.

**Price before terms.** For low and high separately: max(cost ÷ (1 − margin), floor).

**Terms surcharge.**

```
s = max(0, (d_std - d) / 10) * r_d + (t / 30) * r_t
```

d = deposit %, d_std = standard deposit %, t = payment days after shipment, r_d and r_t = surcharge rates (default 1% each). Final unit price = price × (1 + s), rounded up to the next €0.50.

**Delivery plan.** batches = ceil(qty ÷ monthly capacity); first delivery month = ceil(lead weeks ÷ 4.345); batch i ships in month first + i.

**Cash flow (conservative case: low price, high cost).** Month 0: + deposit on total value. For each batch: − parts and assembly cost one month before its delivery; + remaining balance in delivery month + ceil(t ÷ 30). Output cumulative position per month, peak pre-financing, the month it occurs, and financing cost = sum of negative balances × monthly cost of capital.

**Warnings returned by the engine:** pre-financing needed; deposit below first-batch cost; floor sets the price; cost estimated instead of computed; cost run older than 7 days; any BOM line flagged long lead or low stock at this quantity (with the MPN).

**Approval rule.** A quote needs admin approval before it can be marked sent when: price hits the floor, margin is below the product's minimum, deposit is below 30%, or payment terms exceed 60 days. Thresholds live in quote_settings.

Test cases to ship with the module:

- 20,000 units at €86 reference cost with default settings gives €82.00–€99.00 per unit and no pre-financing.
- Deposit 20% adds a 3% surcharge.
- Deposit 0% shows pre-financing starting in month 2.
- Quantity 50 uses the 100-unit factor.

## Price collection

Prices come from official distributor APIs, not website scraping. Each source is an adapter behind one interface, so Octopart/Nexar can be added later without touching the cost engine.

```ts
interface PriceProvider {
  name: string;
  fetch(mpns: string[]): Promise<PriceResult[]>;
}
// PriceResult: mpn, distributor, currency, priceBreaks [{qty, unitPrice}],
// stock, factoryLeadDays | null, lifecycle | null, productUrl, fetchedAt
```

| Provider                               | Priority | Notes                                                              |
| -------------------------------------- | -------- | ------------------------------------------------------------------ |
| Mouser Search API                      | v1       | API key; part number search; returns price breaks and availability |
| Digi-Key Product Information API       | v1       | OAuth2 client credentials; returns pricing, stock and lead time    |
| TME API                                | v1.1     | EU (Poland) distributor; signed requests with token and secret     |
| Farnell / element14 Product Search API | v1.1     | API key; EU stock                                                  |
| Nexar (Octopart)                       | Later    | Aggregates many distributors; postponed until access works         |

Read each provider's current API documentation before implementing it. Field names and auth flows change.

**Weekly cost run** (cron, Monday 06:00 CET, plus a manual "refresh now" button):

1. Load the current BOM version of every cost_plus product.
2. Fetch all MPNs from every enabled provider, with retries and rate-limit backoff; store every result as a price_snapshot.
3. Convert to EUR using the ECB daily reference rate.
4. For each line and each tier (100, 1k, 5k, 10k, 20k boards): needed qty = qty_per_board × boards; pick the cheapest approved offer whose price break fits; if stock < needed qty, still use the price but flag "low stock".
5. Direct-quote lines use the newest valid manual_quote; expired ones are used but flagged "stale".
6. Lines with no price at all are flagged "missing" and lower coverage_pct.
7. Add assembly from assembly_prices for the tier (setup cost spread over the batch); if none, use the admin's assembly estimate and flag it.
8. Save a cost_run and notify supply and engineering by email if new flags appeared.

**Flags and thresholds** (admin-editable): long lead time above 12 weeks; manual quote older than 90 days; lifecycle EOL or NRND; price moved more than 10% since the last run.

**Manual entry screens** for supply: a quick form to log a supplier or assembler quote (part or product, qty, price, date, valid until, note). This is the only data supply has to enter.

## Phases

Eight phases, each a working, deployable increment. One phase at a time. Do not start the next until the acceptance criteria pass. Phases 1–3 replace the standalone calculator. Phase 6 is where price automation starts.

### Phase 0 – Project setup

- Create a Next.js (App Router) + TypeScript project with Tailwind and shadcn/ui; strict TS, ESLint, Prettier.
- Connect Supabase (Postgres, auth, storage); add Drizzle ORM with migrations in the repo.
- Auth: email magic link, restricted to an allowlist of four addresses; roles stored in users.
- App shell: sidebar with Dashboard, Requests, Customers, Products & BOM, Costs, Quotes, Settings.
- Deploy to Vercel with preview deployments; secrets only in environment variables.
- Add a `docs/` folder containing this spec, and a `.cursor/rules` file with the working rules.

Done when: the four users can log in on the deployed URL and see the empty shell; anyone else is rejected.

### Phase 1 – Data model and seed

- Implement every table from the data model as Drizzle schema and migration, including enums and foreign keys.
- Row-level security: everyone reads everything; writes follow role (sales: customers, requests, quotes; engineering: requests triage, products, BOM; supply: manual quotes, assembly prices; admin: all).
- activity_log written automatically on every insert, update and delete.
- Seed: the four users, products Pilot H743 (cost_plus) and Kern Nano / Nano Plus (list_price), quote_settings with the calculator defaults (€86 at 100 units, factors 1.00 / 0.85 / 0.78 / 0.75 / 0.70, margin 30%, floor €80, deposit 50%, 12 weeks, 2,500 per month, 30 days validity, 10% adjustment).

Done when: migrations run from scratch, seed loads, and a role test proves a sales user cannot edit a BOM.

### Phase 2 – Pricing engine

- Build `lib/pricing` exactly as specified: pure functions, typed inputs and outputs, no I/O.
- Vitest unit tests for every formula, rounding, the delivery plan, cash flow, warnings and the reference test cases.
- Function that generates the quote text (same wording as the existing calculator) from engine output.

Done when: all tests pass and the reference cases match the existing calculator to the cent.

### Phase 3 – Quotes module

- Quote form with the calculator inputs; live result panel (price range, totals, deposit, surcharge, delivery, peak pre-financing, warnings, cash-flow chart with Recharts, quote text with copy button).
- Cost source shown on the result: "computed, cost run of <date>" or "estimated from manual cost".
- Save as draft; inputs, outputs and cost_run_id frozen in the quote; quote numbers MR-YYYY-NNNN; editing a sent quote creates a new version.
- Status flow draft → (approval if required) → sent → accepted / lost / expired; expiry set automatically from validity.
- Approval: quotes hitting the approval rule show "needs approval"; admin gets an email with a link and approves or rejects with a comment.
- PDF export with company letterhead and the same content as the text.
- Quotes list with filters by status, customer, product and a total pipeline value.

Done when: Nils can create, approve-route, export and mark as sent a 20,000-unit quote in under 10 minutes.

### Phase 4 – Customers and requests

- Companies and contacts CRUD with search; dedupe warning on similar names.
- Request quick-add: one short form with company, contact, type, product, quantity, urgency and a one-line summary, plus a text box for the pasted original message (stored as raw_text). Only company, type and summary are required. No LLM or other external service processes customer messages.
- Request list with saved views: "New" (for triage), "Mine", "By product", "Quote requests".
- Triage screen for engineering: set status, owner, link to an existing requirement or create one.
- Requirements list sorted by number of linked requests and companies; each shows the requests behind it.
- From a quote-type request, one click opens a prefilled quote.
- Mobile-friendly quick-add, since requests often arrive on the phone.
- Pipedrive two-way sync. Pipedrive stays the source of truth for companies, contacts and deals. First run imports all companies and contacts; after that, sync through Pipedrive webhooks plus a nightly reconciliation job. Saving a quote creates or updates a deal (value = high end of the total, stage mapped from quote status) and attaches the quote PDF. Conflicts: Pipedrive wins for contact data, the tool wins for quote data. Log every sync error with the record id. Read the current Pipedrive API docs before implementing.

Done when: a pasted LinkedIn message becomes a saved, triaged request linked to a requirement in under one minute, and a company or contact edited in Pipedrive shows up in the tool within five minutes.

### Phase 5 – BOM and manual costs

- BOM import from CSV or XLSX with a column-mapping step (MPN, manufacturer, qty, designators, description); validation report for duplicates and empty MPNs; creates a new bom_version.
- BOM viewer: lines, sourcing type, alternates, latest price and flags per line.
- Manual quote and assembly price forms for supply; list with expiry status.
- Cost run v0 using only manual quotes and the factor curve, so the pipeline works before any API exists.

Done when: the Pilot H743 BOM is imported and a cost run with manual data produces tiers and flags.

### Phase 6 – Distributor adapters and weekly cost run

- PriceProvider interface and a mock provider for tests.
- Mouser and Digi-Key adapters first; then TME and Farnell. Each with retry, rate limiting, error logging per MPN, and a settings toggle.
- ECB EUR exchange rates fetched daily and stored.
- Cost run job as specified (Vercel cron or Supabase scheduled function), plus "refresh now".
- Costs page: tier table per product, coverage %, flags list, cost history chart per tier, link to each source offer.
- Email to supply and engineering when new flags appear.

Done when: the weekly run completes unattended, coverage of the Pilot H743 BOM is at least 90%, and quotes use computed cost.

### Phase 7 – Dashboard and weekly digest

- Dashboard: requests by status, top requirements by demand, open quotes and pipeline value, Pilot H743 cost per tier with trend, flagged parts, stale manual quotes.
- Monday email digest per role: what's new, what's flagged, what needs action from that person.

Done when: the weekly ops meeting can run from the dashboard alone.

### Phase 8 – Later (not for v1)

- Nexar/Octopart adapter.
- Inventory and order tracking (units in stock, at assembler, shipped, paid).
- Large-order playbook checklist attached to accepted quotes.

## Working rules

- Work one phase at a time; list the files you will touch before writing code.
- The pricing engine is the source of truth: never duplicate pricing math in UI components.
- Every schema change goes through a migration; never edit the database by hand.
- Money in integer cents, EUR only in the database; convert at the edge.
- Price snapshots and sent quotes are immutable; changes create new rows or versions.
- Every external API call goes through an adapter with timeouts, retries and logged errors; no API keys in code.
- Write Vitest tests for all business logic and Playwright tests for the quote flow.
- Keep UI copy plain and in English; dates as DD.MM.YYYY, numbers in German locale on screens, English locale in quote text.
- When an API's behaviour is unclear, stop and ask instead of guessing field names.

## Open decisions

All decided on 24 Nov 2026:

- Hosting and data location: Supabase EU region and Vercel. Confirmed acceptable for defence-related customer data.
- Who owns the tool after launch: Justus.
- Approved distributors: China-free, best case EU only.
- LLM extraction of customer messages: no. Requests are entered manually; the pasted message is stored as raw text.
- Pipedrive: keep it as the CRM. Two-way sync is part of v1 (phase 4).
