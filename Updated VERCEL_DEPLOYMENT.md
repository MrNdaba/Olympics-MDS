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
   - **`npx prisma migrate deploy`** ⚠️ **CRITICAL: Creates all tables on first deploy**
   - `next build`

**IMPORTANT:** Without the `prisma migrate deploy` step, the database remains empty and all queries will fail with 500 errors.

## 2) Database status

✅ **Postgres migration already completed:**

- Prisma datasource provider in `prisma/schema.prisma` is already set to `postgresql`
- Neon adapter is configured in `src/lib/db.ts` for serverless connections
- 2 migrations are ready to deploy

**Remaining action:** When you deploy to Vercel with `DATABASE_URL` set to your Neon connection string, the `vercel-build` script will automatically run `npx prisma migrate deploy`, which will:
1. Create all required tables
2. Apply all migrations (init + vlm_venue_management)
3. Seed initial data (if Prisma seed is configured)

After first deploy, verify the Neon database via Neon console or `npx prisma studio` to confirm tables were created.

## 3) Required environment variables

Set these in Vercel Project Settings -> Environment Variables.

**CRITICAL — Must be set before first deploy:**

- `DATABASE_URL` — Your Neon connection string (format: `postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require`)

**After migrations run and tables are created, you must seed the database with venues and demo data.**

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
4. Build command: auto-reads from `vercel.json` → runs `npm run vercel-build` which now includes `prisma migrate deploy`.
5. **Set `DATABASE_URL` environment variable** (your Neon connection string).
6. Deploy.

## 5) First-deploy post-setup: Seed the database

After first deployment completes and migrations run, the Neon database will have empty tables. You must seed it with venues, operating days, and demo users:

**Option A: Seed from local (recommended for first setup)**

```bash
DATABASE_URL="your-neon-connection-string" npx prisma db seed
```
7) Optional CLI deploy

You can deploy from local with Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

(Ensure `DATABASE_URL` is set in your Vercel project settings before deploying.)

## 8) Troubleshooting Neon connection

If you see a 500 error during login after deploying:

1. **Check `DATABASE_URL` is set** in Vercel Project Settings.
2. **Check Neon database exists** in Neon console.
3. **Verify migrations ran** during build:
   - Check Vercel build logs for `prisma migrate deploy` output.
   - Check Neon console: `User`, `Venue`, `Session` tables should exist.
4. **If tables are missing**, the migration failed. Re-run build or manually run:
   ```bash
   DATABASE_URL="your-neon-url" npx prisma migrate deploy
   ```
5. **If tables exist but login still fails**, check Vercel function logs for the full error (requires Vercel Pro or higher).

## 9) Suggested production hardening

Before production go-live, complete these steps:

1. ✅ Postgres datasource is already configured.
2. ✅ Migrations are automatically deployed via build script.
3. Seed production database with venues, master data, and initial users (see §5).
4. Keep SMTP credentials only in Vercel environment variables.
5 VLM dashboard pages load.
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
