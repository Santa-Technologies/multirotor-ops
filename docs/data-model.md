# Data model (phase 1)

The Drizzle schema in `db/schema/` is the source of truth; this page explains the parts the code cannot show. Every table has `id` (uuid), `created_at`, `updated_at` and `created_by`. Money is integer euro cents; quantities are integers.

## Who may write what

Everyone signed in reads every table. Writes follow role; admin may write everything. The matrix lives in `lib/auth/permissions.ts` and generates both the row-level security policies (for the Supabase client) and `canWrite()` (for server code, which connects as the table owner through `DATABASE_URL` and bypasses row-level security).

| Tables                                                          | Writers besides admin                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| companies, contacts, quotes                                     | sales                                                            |
| requests                                                        | sales (insert, update, delete); engineering (update, for triage) |
| requirements, products, list_prices, bom_versions, bom_lines    | engineering                                                      |
| manual_quotes, assembly_prices                                  | supply                                                           |
| users, distributors, price_snapshots, cost_runs, quote_settings | admin only                                                       |
| activity_log                                                    | nobody; written only by triggers                                 |

`price_snapshots` and `activity_log` are append-only: a trigger rejects every update and delete, including the table owner's.

## Activity log

Triggers (`drizzle/0002_audit_triggers.sql`) write one `activity_log` row per inserted, updated or deleted row: the whole row for insert and delete, `{ column: { old, new } }` for update. The acting user is the Supabase session user, or, for server writes through `DATABASE_URL`, the `app.user_id` setting:

```sql
select set_config('app.user_id', '<users.id>', true); -- once per transaction, before the write
```

The same triggers fill `created_by` on insert and set `updated_at` on every update. A new table needs its triggers added in a migration.

## Seed

`drizzle/0003_seed_reference_data.sql`, applied by `npm run db:migrate`:

- Products: Pilot H743 (`cost_plus`), Kern Nano and Kern Nano Plus (`list_price`). SKUs and Kern list prices are not set yet.
- Pilot H743 `quote_settings`: €86 manual cost at 100 units; factors 1.00 / 0.85 / 0.78 / 0.75 / 0.70 at 100 / 1,000 / 5,000 / 10,000 / 20,000; margin 30%; floor €80; deposit 50%; 12 weeks lead; 2,500 per month; 30 days validity; 10% adjustment threshold; surcharge rates 1% / 1%; savings 5%, cost risk 15%; approval below 30% deposit or above 60 payment days.
- Users: Justus (`j.nikolaus@santatech.io`, admin), if his Supabase Auth user exists. **Nils, Marc and Volker: emails TBD.** Their rows cannot be seeded ahead of time because `users.id` must equal their Supabase Auth id; they get a row on first sign-in, with the role from `ALLOWED_EMAILS`.

## Choices the spec left open

Each can be changed with a migration; enum values can be added without rewriting data.

- `requests.urgency`: `low`, `normal`, `high`.
- `requirements.status`: `open`, `planned`, `done`, `declined`.
- `quotes.approval_status`: `not_required`, `pending`, `approved`, `rejected`.
- `requests.source_channel`: the four channels in the spec (`linkedin`, `signal`, `email`, `trade_fair`); optional.
- `requests.summary` (required) comes from the phase 4 quick-add, which lists a one-line summary as required.
- `quote_settings` has columns for every default the pricing engine section names but the data model table does not: `manual_cost_cents`, `savings_pct`, `cost_risk_pct`, `min_margin_pct`, `approval_min_deposit_pct`, `approval_max_payment_days`. `surcharges` holds `{ depositRatePct, paymentTermsRatePct }`.
- **Not yet known, left empty:** `quote_settings.min_margin_pct` (the product's minimum margin for approval) and `cost_of_capital_pct` (monthly cost of capital). Phase 2 needs both from the existing calculator.
- `manual_quotes` has separate `mpn` and `assembler` columns; exactly one must be set.
- Quote numbers must match `MR-YYYY-NNNN`; `(number, version)` is unique so a sent quote can get new versions.
- One current BOM version per product is enforced by a partial unique index.
- `activity_log.user_id` has no foreign key, so entries survive deleting the user.

## Testing against a database

`db/rls.test.ts` runs every migration from scratch and on top of an existing 0000 database, checks the seed, row-level security (a sales user cannot edit a BOM), the activity log and the append-only tables. It needs a disposable Postgres whose database name ends in `_test`, and is skipped otherwise:

```bash
createdb kern_test
TEST_DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5432/kern_test npm test
```

It wipes that database and recreates the parts of Supabase the migrations use (`auth.users`, `auth.uid()`, the `authenticated` role).
