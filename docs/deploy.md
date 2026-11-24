# Deploy and environment setup

How to get the app running on Vercel with Supabase so the four users can sign in. Owner: Justus.

Nothing below has been done yet. The code was verified locally against a local Postgres and a mock of the Supabase Auth API, not against a real Supabase project.

## 1. Accounts

| Account                               | Why                                             | Notes                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase organisation + project       | Postgres, email + password auth, storage        | Region **EU (Frankfurt, eu-central-1)**. Save the database password. The free plan pauses after a week without traffic; use Pro for real use. |
| Vercel team (Pro)                     | Hosting, preview deployments, later Vercel Cron | Hobby is for non-commercial use only. Install the Vercel GitHub app on `Santa-Technologies` with access to `multirotor-ops`.                  |
| Resend + a sending domain you control | Later: quote approvals and digests              | Not needed for sign-in. Sign-in uses email and password, so no auth emails are sent.                                                          |

## 2. Supabase settings

1. **Project Settings → API Keys**: copy the project URL and the publishable key (`sb_publishable_…`; the legacy anon key also works).
2. **Connect → Connection string**: copy the **Transaction pooler** URL (port 6543) for the app and the **Session pooler** URL (port 5432) for running migrations.
3. **Authentication → Sign In / Providers**:
   - **User Signups → Allow new users to sign up**: **off**. Only the four users you create exist.
   - **Auth Providers → Email**: **enabled**. Inside it:
     - **Confirm email**: either setting works, because users created with **Auto Confirm User** are already confirmed.
     - **Secure password change**: **off** (the default). If it is on, Supabase emails a code before every password change.
     - **Minimum password length**: **12**, to match the app.
   - There is no separate "magic link" switch: magic links and passwords both belong to the Email provider. The app no longer sends magic links, so nothing else needs to change.
4. **Authentication → Users**: give each of the four users a one-time password.
   - If you still know the passwords you typed when you created them with **Add user → Create new user**, use those.
   - Otherwise, for each user: **⋯ → Delete user**, then **Add user → Create new user** with their email, a one-time password, and **Auto Confirm User** ticked. Deleting also removes their row in `public.users`; it is recreated with the allowlist role on their next sign-in.
   - Pass each password on in person or by Signal, not by email. Everyone then changes it under **Settings → Change password** in the app.
   - If someone forgets their password, delete and re-create that user the same way.
5. **Authentication → URL Configuration**: Site URL = the production URL. Redirect URLs are no longer used for sign-in, so existing entries can stay or go.

The Magic Link email template and SMTP settings are no longer used for sign-in.

## 3. Database migrations

Migrations live in `drizzle/` and are applied with drizzle-kit. Run them once per Supabase project, and again whenever a new migration is merged:

```bash
git clone https://github.com/Santa-Technologies/multirotor-ops.git && cd multirotor-ops
npm ci
DATABASE_URL='<Session pooler URI from Supabase → Connect, port 5432>?sslmode=require' npm run db:migrate
```

Copy the URI from Supabase → **Connect** → **Session pooler** and replace `[YOUR-PASSWORD]` with the database password in your own terminal. It looks like `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Do not paste `drizzle/*.sql` into the SQL editor instead: drizzle-kit would not record it and would try to apply it again.

A successful run ends with `[✓] migrations applied successfully!`. drizzle-kit prints no error when it fails: the output stops at `applying migrations...` and the exit code is 1. Run `npm run db:migrate; echo "exit=$?"` to see which.

| Migration                  | Creates                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `0000_init_users`          | `users`                                                                                                       |
| `0001_phase1_data_model`   | Every other table, enums, foreign keys, row-level security policies by role                                   |
| `0002_audit_triggers`      | `activity_log` on every insert, update and delete; `created_by` / `updated_at`; append-only `price_snapshots` |
| `0003_seed_reference_data` | Products Pilot H743, Kern Nano, Kern Nano Plus; Pilot H743 quote settings; Justus's `users` row (admin)       |

After phase 1, Supabase → **Table Editor** shows 17 tables. Tables, roles and open values: [data model](data-model.md). Never change the schema in the Supabase dashboard; change `db/schema/`, run `npm run db:generate`, and commit the migration.

## 4. Vercel project

1. **Add New → Project** → import `Santa-Technologies/multirotor-ops`. The framework preset is detected as Next.js. The Node.js version comes from `engines` (22+).
2. **Settings → Environment Variables**: add the variables below for **Production** and **Preview**. Their names and formats are in `.env.example`.

   | Variable                               | Value                                                            | Secret                        |
   | -------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                             | No (public)                   |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key                                                  | No (public, protected by RLS) |
   | `DATABASE_URL`                         | Transaction pooler URL, port 6543, with password                 | **Yes**                       |
   | `ALLOWED_EMAILS`                       | `justus@…:admin,nils@…:sales,marc@…:engineering,volker@…:supply` | Treat as private              |

   `NEXT_PUBLIC_*` values are inlined at build time, and Vercel applies env changes only to new deployments. Redeploy after changing any variable.

3. **Settings → Git**: the production branch is `main`. Every pull request gets a preview deployment automatically.
4. **Settings → Deployment Protection**: by default, previews require a Vercel login on your team, and production is public (the app's own login still applies). The four users should use the production URL. If they need previews too, either add them to the Vercel team or turn off Vercel Authentication for previews.
5. `vercel.json` pins functions to `fra1` (Frankfurt) so requests are processed in the EU next to the database.

## 5. Allowlist and roles

- `ALLOWED_EMAILS` is the gate. Anyone not on it is rejected at the login form before their password is sent to Supabase, and on every request by `proxy.ts`. Removing an email ends that person's session on their next request, even if their Supabase user still exists.
- The optional `:role` suffix (`admin`, `sales`, `engineering`, `supply`; default `sales`) is written to `users.role` only when that person first signs in. After that, change roles in the database through a migration or, in a later phase, the Settings page.
- Planned roles: Justus `admin` (`j.nikolaus@santatech.io`), Nils `sales`, Marc `engineering`, Volker `supply`. **Nils's, Marc's and Volker's emails are still TBD.** Their `users` rows cannot be seeded in advance because each row's id must be their Supabase Auth user id. Once their emails are known: add them to `ALLOWED_EMAILS` with their role, redeploy, create their Supabase users (step 4), and their rows appear on first sign-in.

## 6. Smoke test after the first deploy

1. Open the production URL. You are redirected to `/login`.
2. Enter an email that is not on the allowlist with any password: "This email is not allowed to sign in." appears.
3. Each of the four users signs in with their email and one-time password and sees the sidebar (Dashboard, Requests, Customers, Products & BOM, Costs, Quotes, Settings) with their name and role at the bottom.
4. Each user opens **Settings → Change password** and sets their own password.
5. In Supabase → Table Editor → `users` there are four rows with the right roles.

## Troubleshooting sign-in

- **"Wrong email or password."**: re-create the user (step 4) with a new one-time password.
- **"This account is not confirmed yet."**: the user was created without **Auto Confirm User**. Re-create them with it ticked.
- **"This email is not allowed to sign in."**: the email is missing from `ALLOWED_EMAILS` in Vercel, or the change was not redeployed.
- **"Too many attempts."**: Supabase rate-limits sign-ins. All sign-ins come from Vercel's servers, so the limit is shared. Wait a few minutes.
- In Vercel → Logs, `signInWithPassword failed` and `updateUser password failed` show Supabase's error code, never the password.
- **"Sign-in failed on our side."**: the password was right, but the app could not write the `users` row. Vercel → Logs → search `Could not create users row`. The line shows the database error code, never the password or connection string:

| `code` / `message` in the log                                        | Cause and fix                                                                                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `42P01` relation "users" does not exist, or `42704` type "user_role" | Migrations have not run on this project. Run step 3.                                                                                                            |
| `Missing environment variable DATABASE_URL`                          | `DATABASE_URL` is not set for the Production environment in Vercel, or the change was not redeployed.                                                           |
| `28P01` password authentication failed                               | Wrong database password in `DATABASE_URL`. Reset it in Supabase → Database settings and update Vercel.                                                          |
| `Tenant or user not found`                                           | The pooler user must be `postgres.<project-ref>`, not `postgres`. Copy the URI again from Supabase → Connect.                                                   |
| `ENOTFOUND` / `ENETUNREACH` on `db.<ref>.supabase.co`                | That direct host is IPv6-only, which Vercel cannot reach. Use the Transaction pooler URI (port 6543).                                                           |
| `23503` on `users_id_users_id_fk`                                    | `DATABASE_URL` points to a different Supabase project than `NEXT_PUBLIC_SUPABASE_URL`. Use both from the same project.                                          |
| `23505` on `users_email_unique`                                      | A `users` row with this email exists with a different id (the auth user was re-created). Delete that row in Table Editor; it is re-created on the next sign-in. |
| `42501` permission denied / row-level security                       | `DATABASE_URL` uses a role other than `postgres`. Use the `postgres.<project-ref>` URI from Supabase → Connect.                                                 |

## Local development

```bash
cp .env.example .env.local   # fill in values from a Supabase project
npm install
npm run db:migrate
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check`.
