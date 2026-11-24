# multirotor-ops

Kern's internal tool for customer requests, BOM costs and quotes. Full spec: [docs/spec.md](docs/spec.md).

Status: **phase 2** (pure pricing engine in `lib/pricing`; see [docs/pricing.md](docs/pricing.md)). Phase 1: data model, role-based row-level security, activity log and reference seed. Data model notes: [docs/data-model.md](docs/data-model.md).

## Stack

Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui, Supabase (Postgres, auth, storage), Drizzle ORM, Vitest. Hosted on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase values and ALLOWED_EMAILS
npm run db:migrate
npm run dev
```

Setup for Supabase, Vercel and email delivery: [docs/deploy.md](docs/deploy.md).

## Scripts

| Script                            | What it does                                     |
| --------------------------------- | ------------------------------------------------ |
| `npm run dev`                     | Development server                               |
| `npm run build`                   | Production build                                 |
| `npm run typecheck`               | TypeScript, no emit                              |
| `npm run lint`                    | ESLint                                           |
| `npm run format` / `format:check` | Prettier                                         |
| `npm test`                        | Vitest (database tests need `TEST_DATABASE_URL`) |
| `npm run db:generate`             | Create a migration from `db/schema/`             |
| `npm run db:migrate`              | Apply migrations to `DATABASE_URL`               |

## Layout

- `app/(app)/` – signed-in pages behind the sidebar shell
- `app/login`, `app/auth/signout` – email + password sign-in and sign-out
- `app/(app)/settings/password` – change your own password
- `proxy.ts` – refreshes the Supabase session and gates every request
- `lib/pricing/` – pure pricing engine (no I/O): unit cost, price range, surcharge, delivery, cash flow, warnings, approval, quote text
- `lib/auth/` – allowlist, role write permissions, current user, users-row sync
- `lib/supabase/` – server, browser and proxy clients
- `db/schema/`, `drizzle/` – Drizzle schema and migrations
- `test/` – test helpers, including Supabase stand-ins for database tests
- `.cursor/rules/` – working rules for AI agents
