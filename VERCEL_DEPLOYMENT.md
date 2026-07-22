# Vercel Deployment Guide (MDS) — Supabase Postgres

This app runs on **Vercel** (Next.js) with a **Supabase Postgres** database accessed through
**Prisma** (using the `@prisma/adapter-pg` driver adapter). Supabase is used purely as a database —
no Supabase Auth/SDK. Authentication is the app's own bcrypt + server-session implementation.

## 1) How the build works

`vercel.json` sets the build command to `npm run vercel-build`, which runs:

```
npx prisma generate      # regenerate the Prisma client (src/generated is gitignored)
npx prisma migrate deploy # apply prisma/migrations/** to the database (creates tables)
next build
```

`prisma migrate deploy` is what creates every table on the first deploy. Without applied
migrations the database is empty and all queries fail with 500s.

## 2) The two connection strings (IMPORTANT)

Supabase exposes two pooled connection strings (Dashboard → **Project Settings → Database →
Connection string**). Prisma needs **both**, for different jobs:

| Env var        | Supabase mode         | Host / port                        | Used by                          |
| -------------- | --------------------- | ---------------------------------- | -------------------------------- |
| `DATABASE_URL` | **Transaction** pooler | `...pooler.supabase.com:6543`      | App runtime (serverless queries) |
| `DIRECT_URL`   | **Session** pooler     | `...pooler.supabase.com:5432`      | `prisma migrate` / `db seed`     |

- `DATABASE_URL` (port **6543**) — append `?pgbouncer=true&connection_limit=1`. Read by the pg
  adapter in `src/lib/db.ts`.
- `DIRECT_URL` (port **5432**) — no `pgbouncer` flag. Read by `prisma.config.ts` for the CLI.
  DDL and migration advisory locks cannot run through the transaction pooler, so migrations
  **must** use this session-mode connection.

> Both use the format `postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:<port>/postgres`.
> Do **not** use the `db.<ref>.supabase.co` direct host on Vercel — it is IPv6-only and Vercel
> cannot reach it. Always use the `pooler.supabase.com` hosts above.

## 3) Required environment variables (Vercel → Settings → Environment Variables)

Set for **Production** (and Preview if you use it):

- `DATABASE_URL` — transaction pooler string (port 6543, `?pgbouncer=true&connection_limit=1`)
- `DIRECT_URL` — session pooler string (port 5432)

Optional (email notifications, otherwise stubbed to the NotificationOutbox):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## 4) One-time setup

1. Import the Git repository into Vercel. Framework preset: **Next.js**. Root: project root.
2. Build command auto-reads from `vercel.json` → `npm run vercel-build`.
3. Set `DATABASE_URL` and `DIRECT_URL` (section 3) **before** the first deploy.
4. Deploy. The build runs `migrate deploy` and creates all tables.

## 5) Seed the database (after first deploy)

Migrations create empty tables. Load venues (§7), routing (§8), operating hours (§10), master
data, and demo users by running the seed once against Supabase — from your local machine (the
seed uses `DIRECT_URL`):

```bash
# .env already contains DATABASE_URL + DIRECT_URL
npx prisma db seed
```

Verify with `npx prisma studio` or the Supabase Table Editor that `User`, `Venue`, `Session`,
etc. exist and are populated.

## 6) Local development

`.env` (gitignored) holds both connection strings. Then:

```bash
npx prisma migrate deploy   # or `migrate dev` when changing the schema
npx prisma db seed
npm run dev
```

## 7) Troubleshooting

- **500s / "relation does not exist"** → migrations didn't apply. Check the Vercel build log for
  the `prisma migrate deploy` output. Re-run locally: `npx prisma migrate deploy`.
- **`P1001 Can't reach database server`** → wrong host/port or IP restrictions. Use the
  `pooler.supabase.com` hosts, not `db.<ref>.supabase.co`. Confirm the Supabase project is not
  paused.
- **Migrations hang or error on advisory lock** → you pointed `DIRECT_URL` at the 6543 transaction
  pooler. It must be the 5432 session pooler.
- **`prepared statement already exists` at runtime** → `DATABASE_URL` is missing
  `?pgbouncer=true`. Add it.
- **Auth/user-facing errors after tables exist** → the database wasn't seeded (section 5).

## 8) Security notes

- Never commit `.env` (it is gitignored via `.env*`). Set secrets only in Vercel env vars.
- Rotate the Supabase DB password if it has been shared in plaintext (Dashboard → Database →
  Reset database password), then update `DATABASE_URL`/`DIRECT_URL` locally and in Vercel.
</content>
</invoke>
