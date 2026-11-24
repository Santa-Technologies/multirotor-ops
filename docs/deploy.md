# Deploy and environment setup

How to get the app running on Vercel with Supabase so the four users can sign in. Owner: Justus.

Nothing below has been done yet. The code was verified locally against a local Postgres and a mock of the Supabase Auth API, not against a real Supabase project.

## 1. Accounts

| Account                               | Why                                             | Notes                                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase organisation + project       | Postgres, magic-link auth, storage              | Region **EU (Frankfurt, eu-central-1)**. Save the database password. The free plan pauses after a week without traffic; use Pro for real use.                                                                            |
| Vercel team (Pro)                     | Hosting, preview deployments, later Vercel Cron | Hobby is for non-commercial use only. Install the Vercel GitHub app on `Santa-Technologies` with access to `multirotor-ops`.                                                                                             |
| Resend + a sending domain you control | Delivers the magic-link emails via SMTP         | Supabase's built-in mailer only sends to members of the Supabase organisation and is heavily rate-limited, so the four users would not get their links without custom SMTP. Resend is already the spec's email provider. |

## 2. Supabase settings

1. **Project Settings → API Keys**: copy the project URL and the publishable key (`sb_publishable_…`; the legacy anon key also works).
2. **Connect → Connection string**: copy the **Transaction pooler** URL (port 6543) for the app and the **Session pooler** URL (port 5432) for running migrations.
3. **Authentication → Sign In / Providers → Email**: enabled.
4. **Authentication → Users**: add the four users with **Add user → Create new user** (tick auto-confirm). Then, under **Authentication → Sign In / Providers**, turn off **Allow new users to sign up**. The app already refuses non-allowlisted emails before contacting Supabase and signs out any non-allowlisted session, but turning off sign-ups stops anyone from creating Supabase users directly with the public key.
5. **Authentication → URL Configuration**:
   - Site URL: the production URL, e.g. `https://multirotor-ops.vercel.app` or your custom domain.
   - Redirect URLs:
     - `https://<production-domain>/auth/callback`
     - `https://*-<vercel-team-slug>.vercel.app/**` (preview deployments)
     - `http://localhost:3000/auth/callback` (local development)
6. **Authentication → Emails → SMTP Settings**: enable custom SMTP with Resend (`smtp.resend.com`, port 465, user `resend`, password = a Resend API key, sender e.g. `ops@<your-domain>`). Verify the domain in Resend first.
7. **Authentication → Emails → Templates → Magic Link** (**required**): replace the whole message body with the HTML below and save. The subject can stay as it is.

   <!-- prettier-ignore -->
   ```html
   <h2>Sign in to Multirotor Ops</h2>
   <p>Open the link below, then click "Continue signing in". The link works once and expires after one hour.</p>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Multirotor Ops</a></p>
   ```

   Why this is required:
   - Supabase's default template links to `{{ .ConfirmationURL }}`, which uses up the one-time token at Supabase and then hands the app a PKCE `code`. That code only works in the browser that requested the link. Email security scanners (for example Microsoft Defender Safe Links) also open the link first and use up the token. Both cases end on "The sign-in link is invalid or has expired."
   - With this template the link goes straight to the app (`/auth/callback`, the URL that is already on the Redirect URLs list). The app does not verify anything until the user clicks **Continue signing in** on `/auth/confirm`. A scanner that only opens the link therefore cannot use up the token, and the link works on any device or browser.
   - `{{ .RedirectTo }}` brings each user back to the deployment they started from (production or preview). It only works while that URL is on the Redirect URLs list in step 5. Otherwise Supabase substitutes the Site URL and the link breaks.
   - Keep link or click tracking off for the sending domain in Resend. Rewritten links do not work.

## 3. Database migrations

Migrations live in `drizzle/` and are applied with drizzle-kit. Run them once per Supabase project, and again whenever a new migration is merged:

```bash
DATABASE_URL="<session pooler URL, port 5432>" npm run db:migrate
```

Phase 0 creates only `public.users` (id, name, email, role, timestamps) with row-level security enabled and no policies, so the public key cannot read it through the Supabase REST API. The app reads it server-side through `DATABASE_URL`. Never change the schema in the Supabase dashboard; change `db/schema.ts`, run `npm run db:generate`, and commit the migration.

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

- `ALLOWED_EMAILS` is the only gate. Anyone not on it is rejected at the login form (no email is sent), at `/auth/callback`, and on every request by `proxy.ts`. Removing an email ends that person's session on their next request.
- The optional `:role` suffix (`admin`, `sales`, `engineering`, `supply`; default `sales`) is written to `users.role` only when that person first signs in. After that, change roles in the database through a migration or, from phase 1, the Settings page.
- Planned roles: Justus `admin`, Nils `sales`, Marc `engineering`, Volker `supply`.

## 6. Smoke test after the first deploy

1. Open the production URL. You are redirected to `/login`.
2. Enter an email that is not on the allowlist: "This email is not allowed to sign in." appears and no email is sent.
3. Each of the four users enters their email, opens the link, clicks **Continue signing in** and sees the sidebar (Dashboard, Requests, Customers, Products & BOM, Costs, Quotes, Settings) with their name and role at the bottom.
4. In Supabase → Table Editor → `users` there are four rows with the right roles.

## Troubleshooting sign-in

- **"The sign-in link is invalid or has expired."**
  - Check that the Magic Link template matches step 7. With the default template, links break whenever a mail scanner opens them first or they are opened in another browser.
  - Each link works once and only the newest link is valid, so request a new one and use the latest email.
  - In Vercel → Logs, look for `Magic link verification failed` or `Magic link without usable parameters`. These lines show Supabase's error code (for example `otp_expired`) and never contain the token.
- **The link opens the production home page instead of `/auth/callback`**: the deployment's callback URL is missing from the Redirect URLs list (step 5).

## Local development

```bash
cp .env.example .env.local   # fill in values from a Supabase project
npm install
npm run db:migrate
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check`.
