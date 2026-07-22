# Vercel Deployment Guide (MDS)

This document explains how to deploy MDS on Vercel and what to configure.

## 1) What was added

- Deployment config: `vercel.json`
- Build script: `npm run vercel-build` in `package.json`

Current Vercel build flow:

1. `npm ci`
2. `npm run vercel-build`
3. `npm run vercel-build` runs:
   - `npx prisma generate`
   - `next build`

## 2) Important database note

The current Prisma datasource provider in `prisma/schema.prisma` is `sqlite`.

SQLite is fine for local development, but it is not suitable for persistent production data on Vercel serverless runtimes.

Recommended production path:

- Use a managed Postgres database (for example Vercel Postgres, Neon, Supabase, or RDS).
- Switch Prisma datasource provider from `sqlite` to `postgresql`.
- Regenerate Prisma client and run migrations for Postgres.

If you deploy without moving to Postgres, treat that deployment as demo-only.

## 3) Required environment variables

Set these in Vercel Project Settings -> Environment Variables.

Minimum:

- `DATABASE_URL`

Optional (email notifications):

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true` or `false`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## 4) One-time Vercel setup

1. Import the Git repository into Vercel.
2. Framework preset: Next.js.
3. Root directory: project root (`/`).
4. Build command should be auto-read from `vercel.json`.
5. Add environment variables.
6. Deploy.

## 5) Post-deploy checks

After the first successful deployment, verify:

- Login flow works.
- Booking pages load and submit correctly.
- VLM dashboard pages load.
- Any email/notification behavior expected in your environment.

## 6) Optional CLI deploy

You can deploy from local with Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

## 7) Suggested production hardening

Before production go-live, complete these steps:

1. Migrate Prisma datasource to Postgres.
2. Run Postgres migrations in CI/CD or a controlled release job.
3. Keep SMTP credentials only in Vercel environment variables.
4. Confirm logs do not expose secrets and match audit requirements in the spec.
