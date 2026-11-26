# Data model

The Drizzle schema in `db/schema/` is the source of truth; this page explains the shape and the phase deltas. Every table has `id` (uuid), `created_at`, `updated_at` and `created_by`. Money is integer euro cents; quantities are integers.

## Target shape (parts-first)

```
product_lines 1──* products (variants)
products 1──* bom_versions 1──* bom_lines *──1 parts
parts 1──* price_snapshots / manual offers / inventory / rfq_threads
products 1──* cost_runs, quote_settings, assembly_prices, finished goods, assembly lots
companies / contacts / pipedrive deals ⋯ optional link ⋯ requests
```

`products` remains the variant table (quotes, cost runs and settings already FK here). A **product line** groups variants (e.g. Pilot H743 → Standard, Alt IMU).

## Phase 3 schema (implemented)

| Table / change        | Fields / notes                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `product_lines`       | `name` (unique), `description`, `active`                                                                            |
| `products`            | Adds `product_line_id` (required), `variant_label` (unique per line). `name` stays the unique display name          |
| `parts`               | `mpn` (unique, case-insensitive), `manufacturer`, `description`, `default_sourcing`                                 |
| `bom_lines`           | `part_id` FK (required); drops embedded `mpn` / `manufacturer` / `description` (those live on `parts`)              |
| `bom_versions`        | Unchanged conceptually; still one current version per **variant** (`products`)                                      |

BOM import upserts `parts` by MPN and creates a new `bom_version` whose lines only store `part_id`, qty, designators, sourcing and alternates (MPN strings).

## Later schema (not in phase 3)

Documented so later phases do not reinvent names. Implement only via migrations when that phase starts.

| Phase | Tables / changes                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5     | `part_inventory` (on_hand, on_order_qty, eta, po_ref); `finished_goods` (variant_id, qty); `assembly_lots` (variant_id, qty, status, eta, notes) |
| 6     | Optional `price_snapshots.part_id`; keep `mpn` for raw fetch identity                                                                            |
| 7     | `suppliers` (name, email, notes); `part_suppliers`; `rfq_threads` (part_id, supplier_id, status, message ids); `rfq_offers` (parsed draft → confirm) |
| 8     | `pipedrive_deals` or soft ids on companies/contacts/requests; `requests.pipedrive_deal_id` optional                                              |
| 9     | Quote send fields already largely present (`status`, `sent_at`, approval); tighten copy and workflows                                            |

## Who may write what

Everyone signed in reads every table. Writes follow role; admin may write everything. The matrix lives in `lib/auth/permissions.ts` and generates both the row-level security policies (for the Supabase client) and `canWrite()` (for server code, which connects as the table owner through `DATABASE_URL` and bypasses row-level security).

| Tables                                                                       | Writers besides admin                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| companies, contacts, quotes                                                  | sales                                                            |
| requests                                                                     | sales (insert, update, delete); engineering (update, for triage) |
| requirements, product_lines, products, parts, list_prices, bom_versions, bom_lines | engineering                                                |
| manual_quotes, assembly_prices                                               | supply                                                           |
| users, distributors, price_snapshots, quote_settings                         | admin only                                                       |
| cost_runs                                                                    | engineering (refresh after BOM / manual prices); admin           |
| activity_log                                                                 | nobody; written only by triggers                                 |

`price_snapshots` and `activity_log` are append-only: a trigger rejects every update and delete, including the table owner's.

## Activity log

Triggers (`drizzle/0002_audit_triggers.sql`, plus later migrations for new tables) write one `activity_log` row per inserted, updated or deleted row. The acting user is the Supabase session user, or, for server writes through `DATABASE_URL`, the `app.user_id` setting:

```sql
select set_config('app.user_id', '<users.id>', true); -- once per transaction, before the write
```

The same triggers fill `created_by` on insert and set `updated_at` on every update. A new table needs its triggers added in a migration.

## Seed

`drizzle/0003_seed_reference_data.sql` and `0004_pilot_h743_margin_and_capital.sql`, plus phase 3 data migration:

- Product lines and default variants: Pilot H743 (`cost_plus`), CoPilot Nano and CoPilot Nano Plus (`list_price`). Legacy seed names “Kern Nano” / “Kern Nano Plus” are renamed to CoPilot in the phase 3 migration.
- Pilot H743 `quote_settings`: €86 manual cost at 100 units; factors 1.00 / 0.85 / 0.78 / 0.75 / 0.70 at 100 / 1,000 / 5,000 / 10,000 / 20,000; margin 30%; floor €80; deposit 50%; 12 weeks lead; 2,500 per month; 30 days validity; 10% adjustment threshold; surcharge rates 1% / 1%; savings 5%, cost risk 15%; approval below 30% deposit, above 60 payment days or below 25% margin; cost of capital 1% per month.
- Users: Justus (`j.nikolaus@santatech.io`, admin), if his Supabase Auth user exists. **Nils, Marc and Volker: emails TBD.** Their rows cannot be seeded ahead of time because `users.id` must equal their Supabase Auth id; they get a row on first sign-in, with the role from `ALLOWED_EMAILS`.

## Choices left open or fixed in code

- `requests.urgency`: `low`, `normal`, `high`.
- `requirements.status`: `open`, `planned`, `done`, `declined`.
- `quotes.approval_status`: `not_required`, `pending`, `approved`, `rejected`.
- `parts.mpn` uniqueness is case-insensitive (`lower(mpn)` unique index).
- One current BOM version per variant is enforced by a partial unique index on `bom_versions`.
- `variant_label` defaults to `Standard` for the first variant of a line.
- `manual_quotes` still keys off `mpn` text until a later migration adds `part_id`.
- Quote numbers must match `MR-YYYY-NNNN`; `(number, version)` is unique.
- `activity_log.user_id` has no foreign key, so entries survive deleting the user.

## Testing against a database

`db/rls.test.ts` runs every migration from scratch and on top of an existing 0000 database, checks the seed, row-level security (a sales user cannot edit a BOM), the activity log and the append-only tables. It needs a disposable Postgres whose database name ends in `_test`, and is skipped otherwise:

```bash
createdb kern_test
TEST_DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5432/kern_test npm test
```

It wipes that database and recreates the parts of Supabase the migrations use (`auth.users`, `auth.uid()`, the `authenticated` role).
